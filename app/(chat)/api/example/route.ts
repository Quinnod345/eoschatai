import { StreamingText } from 'ai';
import { xai } from '@ai-sdk/xai';

export const runtime = 'edge';

export async function GET() {
  const response = await xai("grok-2-1212").complete({
    prompt: "Invent a new holiday and describe its traditions.",
    stream: true
  });

  // Return a streaming response
  return new StreamingText({ text: response });
} 