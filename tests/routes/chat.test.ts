import { generateUUID } from '@/lib/utils';
import { expect, test } from '../fixtures';
import { getContextAccess, resetContextUsage, setContextUsage } from '../helpers';
import { TEST_PROMPTS } from '../prompts/routes';

const chatIdsCreatedByAda: Array<string> = [];

test.describe
  .serial('/api/chat', () => {
    test('Ada cannot invoke a chat generation with empty request body', async ({
      adaContext,
    }) => {
      const response = await adaContext.request.post('/api/chat', {
        data: JSON.stringify({}),
      });
      expect(response.status()).toBe(400);

      const text = await response.text();
      expect(text).toEqual('Invalid request body');
    });

    test('Ada can invoke chat generation', async ({ adaContext }) => {
      const chatId = generateUUID();

      const response = await adaContext.request.post('/api/chat', {
        data: {
          id: chatId,
          message: TEST_PROMPTS.SKY.MESSAGE,
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });
      expect(response.status()).toBe(200);

      const text = await response.text();
      const lines = text.split('\n');
      const events = lines.filter(Boolean);
      expect(events.some((line) => line.includes('"type":"text-delta"'))).toBe(
        true,
      );
      expect(events[events.length - 1]).toContain('[DONE]');

      chatIdsCreatedByAda.push(chatId);
    });

    test("Babbage cannot append message to Ada's chat", async ({
      babbageContext,
    }) => {
      const [chatId] = chatIdsCreatedByAda;

      const response = await babbageContext.request.post('/api/chat', {
        data: {
          id: chatId,
          message: TEST_PROMPTS.GRASS.MESSAGE,
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });
      expect(response.status()).toBe(403);

      const text = await response.text();
      expect(text === 'Forbidden' || text.includes('permission')).toBe(true);
    });

    test("Babbage cannot delete Ada's chat", async ({ babbageContext }) => {
      const [chatId] = chatIdsCreatedByAda;

      const response = await babbageContext.request.delete(
        `/api/chat?id=${chatId}`,
      );
      expect(response.status()).toBe(403);

      const text = await response.text();
      expect(text === 'Forbidden' || text.includes('permission')).toBe(true);
    });

    test('Ada can delete her own chat', async ({ adaContext }) => {
      const [chatId] = chatIdsCreatedByAda;

      const response = await adaContext.request.delete(
        `/api/chat?id=${chatId}`,
      );
      expect(response.status()).toBe(200);

      const deletedChat = await response.json();
      expect(deletedChat).toMatchObject({ id: chatId });
    });

    test('Ada cannot resume stream of chat that does not exist', async ({
      adaContext,
    }) => {
      const response = await adaContext.request.get(
        `/api/chat?chatId=${generateUUID()}`,
      );
      expect(response.status()).toBe(404);
    });

    test('Ada can resume chat generation', async ({ adaContext }) => {
      const chatId = generateUUID();

      const firstRequest = adaContext.request.post('/api/chat', {
        data: {
          id: chatId,
          message: {
            id: generateUUID(),
            role: 'user',
            content: 'Help me write an essay about Silcon Valley',
            parts: [
              {
                type: 'text',
                text: 'Help me write an essay about Silicon Valley',
              },
            ],
            createdAt: new Date().toISOString(),
          },
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const secondRequest = adaContext.request.get(
        `/api/chat?chatId=${chatId}`,
      );

      const [firstResponse, secondResponse] = await Promise.all([
        firstRequest,
        secondRequest,
      ]);

      const [firstStatusCode, secondStatusCode] = await Promise.all([
        firstResponse.status(),
        secondResponse.status(),
      ]);

      expect(firstStatusCode).toBe(200);
      expect([200, 204]).toContain(secondStatusCode);

      const firstResponseBody = await firstResponse.body();
      const secondResponseBody = await secondResponse.body();

      if (secondStatusCode === 200) {
        expect(firstResponseBody.toString()).toEqual(secondResponseBody.toString());
      } else {
        expect(secondResponseBody.toString()).toEqual('');
      }
    });

    test('Ada cannot resume chat generation that has ended', async ({
      adaContext,
    }) => {
      const chatId = generateUUID();

      const firstRequest = await adaContext.request.post('/api/chat', {
        data: {
          id: chatId,
          message: {
            id: generateUUID(),
            role: 'user',
            content: 'Help me write an essay about Silcon Valley',
            parts: [
              {
                type: 'text',
                text: 'Help me write an essay about Silicon Valley',
              },
            ],
            createdAt: new Date().toISOString(),
          },
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });

      const secondRequest = adaContext.request.get(
        `/api/chat?chatId=${chatId}`,
      );

      const [firstResponse, secondResponse] = await Promise.all([
        firstRequest,
        secondRequest,
      ]);

      const [firstStatusCode, secondStatusCode] = await Promise.all([
        firstResponse.status(),
        secondResponse.status(),
      ]);

      expect(firstStatusCode).toBe(200);
      expect([200, 204]).toContain(secondStatusCode);

      const [, secondResponseContent] = await Promise.all([
        firstResponse.text(),
        secondResponse.text(),
      ]);

      expect(secondResponseContent).toEqual('');
    });

    test('Babbage cannot resume a private chat generation that belongs to Ada', async ({
      adaContext,
      babbageContext,
    }) => {
      const chatId = generateUUID();

      const firstRequest = adaContext.request.post('/api/chat', {
        data: {
          id: chatId,
          message: {
            id: generateUUID(),
            role: 'user',
            content: 'Help me write an essay about Silcon Valley',
            parts: [
              {
                type: 'text',
                text: 'Help me write an essay about Silicon Valley',
              },
            ],
            createdAt: new Date().toISOString(),
          },
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const secondRequest = babbageContext.request.get(
        `/api/chat?chatId=${chatId}`,
      );

      const [firstResponse, secondResponse] = await Promise.all([
        firstRequest,
        secondRequest,
      ]);

      const [firstStatusCode, secondStatusCode] = await Promise.all([
        firstResponse.status(),
        secondResponse.status(),
      ]);

      expect(firstStatusCode).toBe(200);
      expect(secondStatusCode).toBe(403);
    });

    test('Babbage can resume a public chat generation that belongs to Ada', async ({
      adaContext,
      babbageContext,
    }) => {
      const chatId = generateUUID();

      const firstRequest = adaContext.request.post('/api/chat', {
        data: {
          id: chatId,
          message: {
            id: generateUUID(),
            role: 'user',
            content: 'Help me write an essay about Silicon Valley',
            parts: [
              {
                type: 'text',
                text: 'Help me write an essay about Silicon Valley',
              },
            ],
            createdAt: new Date().toISOString(),
          },
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'public',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const secondRequest = babbageContext.request.get(
        `/api/chat?chatId=${chatId}`,
      );

      const [firstResponse, secondResponse] = await Promise.all([
        firstRequest,
        secondRequest,
      ]);

      const [firstStatusCode, secondStatusCode] = await Promise.all([
        firstResponse.status(),
        secondResponse.status(),
      ]);

      expect(firstStatusCode).toBe(200);
      expect([200, 204]).toContain(secondStatusCode);

      const [firstResponseContent, secondResponseContent] = await Promise.all([
        firstResponse.text(),
        secondResponse.text(),
      ]);

      if (secondStatusCode === 200) {
        expect(firstResponseContent).toEqual(secondResponseContent);
      } else {
        expect(secondResponseContent).toEqual('');
      }
    });
  });

test.describe
  .serial('/api/chat entitlements', () => {
    test('Free users are blocked when reaching daily chat limit', async ({
      freeContext,
    }) => {
      const accessContext = await getContextAccess(freeContext);
      const chatLimit = accessContext.entitlements.features.chats_per_day;

      await resetContextUsage(freeContext);
      await setContextUsage(freeContext, { chats_today: chatLimit });

      const response = await freeContext.request.post('/api/chat', {
        data: {
          id: generateUUID(),
          message: TEST_PROMPTS.SKY.MESSAGE,
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });

      expect(response.status()).toBe(429);
      const payload = await response.json();
      expect(payload).toMatchObject({
        error: 'DAILY_LIMIT_REACHED',
        limit: chatLimit,
        used: chatLimit,
        plan: 'free',
      });
    });

    test('Business users can chat above free-tier limits', async ({
      businessContext,
    }) => {
      await resetContextUsage(businessContext);
      await setContextUsage(businessContext, { chats_today: 20 });

      const response = await businessContext.request.post('/api/chat', {
        data: {
          id: generateUUID(),
          message: TEST_PROMPTS.SKY.MESSAGE,
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });

      expect(response.status()).toBe(200);
    });

    test('Business users are blocked when reaching business daily limit', async ({
      businessContext,
    }) => {
      const accessContext = await getContextAccess(businessContext);
      const chatLimit = accessContext.entitlements.features.chats_per_day;

      await resetContextUsage(businessContext);
      await setContextUsage(businessContext, { chats_today: chatLimit });

      const response = await businessContext.request.post('/api/chat', {
        data: {
          id: generateUUID(),
          message: TEST_PROMPTS.SKY.MESSAGE,
          selectedChatModel: 'chat-model',
          selectedProvider: 'anthropic',
          selectedVisibilityType: 'private',
        },
      });

      expect(response.status()).toBe(429);
      const payload = await response.json();
      expect(payload).toMatchObject({
        error: 'DAILY_LIMIT_REACHED',
        limit: chatLimit,
        used: chatLimit,
        plan: 'business',
      });
    });
  });
