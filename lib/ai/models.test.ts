import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { getResponseChunksByPrompt } from '@/tests/prompts/utils';

// AI SDK 5: MockLanguageModelV3 has different callback signatures
// Use type assertions for test compatibility
export const chatModel = new MockLanguageModelV3({
  doGenerate: (async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20 },
    text: `Hello, world!`,
  })) as any,
  doStream: (async ({ prompt }: any) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt(prompt),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  })) as any,
});

export const titleModel = new MockLanguageModelV3({
  doGenerate: (async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20 },
    text: `This is a test title`,
  })) as any,
  doStream: (async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: [
        { type: 'text-delta', textDelta: 'This is a test title' },
        {
          type: 'finish',
          finishReason: 'stop',
          logprobs: undefined,
          usage: { outputTokens: 10, inputTokens: 3 },
        },
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  })) as any,
});

export const composerModel = new MockLanguageModelV3({
  doGenerate: (async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20 },
    text: `Hello, world!`,
  })) as any,
  doStream: (async ({ prompt }: any) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 100,
      chunks: getResponseChunksByPrompt(prompt),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  })) as any,
});
