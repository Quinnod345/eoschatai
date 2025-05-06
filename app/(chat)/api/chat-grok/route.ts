import { StreamingTextResponse } from 'ai';
import { xai } from '@ai-sdk/xai';

export const runtime = 'edge';

export async function POST(req: Request) {
  // Get the prompt from the request body
  const { prompt } = await req.json();
  
  if (!prompt) {
    return new Response('Missing prompt in request body', { status: 400 });
  }

  // Call the Grok model with streaming enabled
  const response = await xai("grok-2-1212").complete({
    prompt,
    stream: true
  });

  // Return a streaming response
  return new StreamingTextResponse(response);
} 