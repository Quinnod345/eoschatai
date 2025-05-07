import { NextRequest } from 'next/server';
import { PROVIDERS } from '@/lib/ai/providers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider');

    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'Missing provider parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let apiKeyConfigured = false;
    let apiKeyName = '';

    // Check if the provider's API key is configured
    if (provider === PROVIDERS.OPENAI) {
      apiKeyConfigured = !!process.env.OPENAI_API_KEY;
      apiKeyName = 'OPENAI_API_KEY';
    } else if (provider === PROVIDERS.XAI) {
      apiKeyConfigured = !!process.env.XAI_API_KEY;
      apiKeyName = 'XAI_API_KEY';
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKeyConfigured) {
      return new Response(
        JSON.stringify({
          error: 'API key not configured',
          message: `The ${apiKeyName} environment variable is not set. Please configure it in your environment.`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, provider }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking API key:', error);
    return new Response(
      JSON.stringify({ error: 'Server error checking API key' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 