import { describe, expect, it, vi } from 'vitest';
import {
  buildCalendarPromptAdditions,
  dedupeMessagesById,
  extractAssistantTextFromMessage,
  extractPrimaryMessageText,
} from '@/lib/ai/chat-route-helpers';
import { postRequestBodySchema } from '@/app/(chat)/api/chat/schema';

describe('chat route helpers', () => {
  it('extracts first text part before falling back to content', () => {
    expect(
      extractPrimaryMessageText({
        parts: [
          { type: 'file', url: 'https://example.com/file.pdf' },
          { type: 'text', text: '  first text  ' },
        ],
        content: 'fallback',
      }),
    ).toBe('first text');
  });

  it('falls back to message content when parts have no text', () => {
    expect(
      extractPrimaryMessageText({
        parts: [{ type: 'file', url: 'https://example.com/file.pdf' }],
        content: 'fallback content',
      }),
    ).toBe('fallback content');
  });

  it('extracts assistant text from parts with content fallback', () => {
    expect(
      extractAssistantTextFromMessage({
        parts: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }],
      }),
    ).toBe('Hello world');

    expect(extractAssistantTextFromMessage({ content: 'fallback text' })).toBe(
      'fallback text',
    );
  });

  it('deduplicates previous messages by current message id', () => {
    const deduped = dedupeMessagesById(
      [
        { id: 'a', role: 'user' },
        { id: 'b', role: 'assistant' },
        { id: 'a', role: 'user' },
      ],
      'a',
    );

    expect(deduped).toEqual([{ id: 'b', role: 'assistant' }]);
  });

  it('awaits both calendar prefetch paths deterministically', async () => {
    const fetchCalendarEvents = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'success',
        events: [
          {
            summary: 'Quarterly Session',
            start: { dateTime: '2026-02-10T16:00:00.000Z' },
            location: 'HQ',
          },
        ],
      })
      .mockResolvedValueOnce({
        status: 'success',
        events: [],
      });

    const logger = { log: vi.fn(), error: vi.fn() };
    const additions = await buildCalendarPromptAdditions({
      hasMentionedCalendar: true,
      shouldCheckCalendar: true,
      eventType: 'quarterly session',
      fetchCalendarEvents,
      logger,
    });

    expect(fetchCalendarEvents).toHaveBeenCalledTimes(2);
    expect(fetchCalendarEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ maxResults: 15 }),
    );
    expect(fetchCalendarEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        maxResults: 20,
        searchTerm: 'quarterly session',
      }),
    );
    expect(additions).toContain('CALENDAR RESULTS FROM @ MENTION');
    expect(additions).toContain('CALENDAR SEARCH RESULTS');
  });
});

describe('chat request schema', () => {
  const baseBody = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    message: {
      id: 'msg_1',
      role: 'user' as const,
      content: 'hello',
      parts: [{ type: 'text' as const, text: 'hello' }],
    },
    selectedChatModel: 'chat-model' as const,
    selectedProvider: 'anthropic' as const,
    selectedVisibilityType: 'private' as const,
  };

  it('rejects empty parts array', () => {
    expect(() =>
      postRequestBodySchema.parse({
        ...baseBody,
        message: {
          ...baseBody.message,
          parts: [],
        },
      }),
    ).toThrow();
  });

  it('accepts at least one part', () => {
    expect(() => postRequestBodySchema.parse(baseBody)).not.toThrow();
  });
});
