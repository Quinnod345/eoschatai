import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findRelevantContent: vi.fn(),
  systemPrompt: vi.fn(),
  streamText: vi.fn(),
  languageModel: vi.fn(),
}));

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/ai/embeddings', () => ({
  findRelevantContent: mocks.findRelevantContent,
}));

vi.mock('@/lib/ai/tools', () => ({
  addResourceTool: { execute: vi.fn() },
  getInformationTool: { execute: vi.fn() },
}));

vi.mock('@/lib/ai/providers', () => ({
  myProvider: {
    languageModel: mocks.languageModel,
  },
}));

vi.mock('@/lib/ai/prompts', () => ({
  systemPrompt: mocks.systemPrompt,
}));

vi.mock('ai', () => ({
  streamText: mocks.streamText,
  tool: vi.fn((definition: unknown) => definition),
}));

import { POST } from '@/app/api/chat-rag/route';

describe('chat-rag route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.languageModel.mockReturnValue({ id: 'mock-model' });
    mocks.systemPrompt.mockResolvedValue('mock system prompt');
    mocks.findRelevantContent.mockResolvedValue([]);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.auth.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/chat-rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);

    const payload = await response.json();
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns a streaming response for authenticated requests', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.streamText.mockReturnValue({
      toUIMessageStreamResponse: () => new Response('ok', { status: 200 }),
    });

    const request = new Request('http://localhost:3000/api/chat-rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'How do EOS scorecards work?' }],
      }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');

    expect(mocks.findRelevantContent).toHaveBeenCalled();
    expect(mocks.streamText).toHaveBeenCalled();
  });

  it('returns 500 when RAG retrieval fails', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-2' } });
    mocks.findRelevantContent.mockRejectedValue(new Error('vector failure'));

    const request = new Request('http://localhost:3000/api/chat-rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is EOS?' }],
      }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(503);

    const payload = await response.json();
    expect(payload).toHaveProperty('error');
    expect(payload).toHaveProperty('message');
  });
});
