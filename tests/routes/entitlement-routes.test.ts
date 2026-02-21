import { expect, test } from '../fixtures';
import {
  getContextAccess,
  resetContextUsage,
  setContextUsage,
} from '../helpers';

const BASE_URL = 'http://localhost:3000';

function expectUnauthorizedStatus(status: number) {
  expect([401, 302, 307, 403]).toContain(status);
}

test.describe
  .serial('/entitlement-routes', () => {
    test('Unauthenticated requests to document upload are rejected', async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const response = await context.request.post(
        `${BASE_URL}/api/documents/upload`,
      );

      expectUnauthorizedStatus(response.status());
      await context.close();
    });

    test('Document upload blocks free users at upload limit', async ({
      freeContext,
    }) => {
      const accessContext = await getContextAccess(freeContext);
      const uploadLimit =
        accessContext.entitlements.features.context_uploads_total;

      await resetContextUsage(freeContext);
      await setContextUsage(freeContext, { uploads_total: uploadLimit });

      const response = await freeContext.request.post('/api/documents/upload');
      expect(response.status()).toBe(403);

      const payload = await response.json();
      expect(payload).toMatchObject({
        code: 'ENTITLEMENT_BLOCK',
        feature: 'context_uploads_total',
        reason: 'limit_exceeded',
      });
    });

    test('Document upload allows business users beyond free thresholds', async ({
      businessContext,
    }) => {
      await resetContextUsage(businessContext);
      await setContextUsage(businessContext, { uploads_total: 20 });

      const response = await businessContext.request.post(
        '/api/documents/upload',
      );
      expect([400, 500]).toContain(response.status());
    });

    test('Unauthenticated requests to /api/files/document are rejected', async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const response = await context.request.post(
        `${BASE_URL}/api/files/document`,
      );

      expectUnauthorizedStatus(response.status());
      await context.close();
    });

    test('/api/files/document blocks free users at upload limit', async ({
      freeContext,
    }) => {
      const accessContext = await getContextAccess(freeContext);
      const uploadLimit =
        accessContext.entitlements.features.context_uploads_total;

      await resetContextUsage(freeContext);
      await setContextUsage(freeContext, { uploads_total: uploadLimit });

      const response = await freeContext.request.post('/api/files/document');
      expect(response.status()).toBe(403);

      const payload = await response.json();
      expect(payload).toMatchObject({
        code: 'ENTITLEMENT_BLOCK',
        feature: 'context_uploads_total',
        reason: 'limit_exceeded',
      });
    });

    test('/api/files/document allows business users to proceed past entitlement check', async ({
      businessContext,
    }) => {
      await resetContextUsage(businessContext);
      await setContextUsage(businessContext, { uploads_total: 20 });

      const response = await businessContext.request.post('/api/files/document');
      expect([400, 500]).toContain(response.status());
    });

    test('Unauthenticated requests to /api/memories are rejected', async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const response = await context.request.post(`${BASE_URL}/api/memories`, {
        data: {},
      });

      expectUnauthorizedStatus(response.status());
      await context.close();
    });

    test('/api/memories blocks free users from long-term memory', async ({
      freeContext,
    }) => {
      const response = await freeContext.request.post('/api/memories', {
        data: {},
      });
      expect(response.status()).toBe(403);

      const payload = await response.json();
      expect(payload).toMatchObject({
        code: 'FEATURE_LOCKED',
        feature: 'memory',
        requiredPlan: 'pro',
      });
    });

    test('/api/memories allows business users to pass entitlement gate', async ({
      businessContext,
    }) => {
      const response = await businessContext.request.post('/api/memories', {
        data: {},
      });

      // Validation fails because body is intentionally incomplete,
      // but entitlement gate should allow business users through.
      expect(response.status()).toBe(400);
    });

    test('Unauthenticated requests to /api/chat-rag are rejected', async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const response = await context.request.post(`${BASE_URL}/api/chat-rag`, {
        data: {},
      });

      expectUnauthorizedStatus(response.status());
      await context.close();
    });

    test('/api/chat-rag is reachable by business users', async ({
      businessContext,
    }) => {
      const response = await businessContext.request.post('/api/chat-rag', {
        data: {},
      });

      // The payload is intentionally invalid to avoid external model dependencies.
      // This asserts business users are not blocked by auth/entitlements.
      expect(response.status()).toBe(500);
    });
  });
