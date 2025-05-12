import type { NextRequest } from 'next/server';
import { PROVIDERS } from '@/lib/ai/providers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    const debug = searchParams.get('debug') === 'true';
    const forceBypasses = searchParams.get('force') === 'true'; // Allow forcing success for debugging

    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'Missing provider parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    console.log(`API key check requested for provider: ${provider}`);

    let apiKeyConfigured = false;
    let apiKeyName = '';
    let apiKeyValue = '';

    // Check if the provider's API key is configured
    if (provider === PROVIDERS.OPENAI) {
      apiKeyConfigured = !!process.env.OPENAI_API_KEY;
      apiKeyName = 'OPENAI_API_KEY';
      apiKeyValue = process.env.OPENAI_API_KEY || '';
    } else if (provider === PROVIDERS.XAI) {
      apiKeyConfigured = !!process.env.XAI_API_KEY;
      apiKeyName = 'XAI_API_KEY';
      apiKeyValue = process.env.XAI_API_KEY || '';
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Always consider the API key configured in dev mode or if forced
    if (process.env.NODE_ENV === 'development' || forceBypasses) {
      console.log(
        `Development mode or force bypass: allowing ${provider} without API key validation`,
      );
      apiKeyConfigured = true;

      // In development, even pretend the key exists for better UX
      if (!apiKeyValue && process.env.NODE_ENV === 'development') {
        apiKeyValue = 'dev-mode-fake-key-for-testing';
      }
    }

    // Log key details (with redaction)
    if (debug || forceBypasses) {
      console.log(`API key check for ${provider}:`);
      console.log(`- Key name: ${apiKeyName}`);
      console.log(`- Key configured: ${apiKeyConfigured}`);
      console.log(`- Key present: ${apiKeyValue ? 'Yes (redacted)' : 'No'}`);
      console.log(`- Key length: ${apiKeyValue.length}`);
      if (apiKeyValue) {
        console.log(`- Key start: ${apiKeyValue.substring(0, 3)}...`);
      }
    }

    if (!apiKeyConfigured) {
      console.error(`${apiKeyName} not configured in environment`);

      return new Response(
        JSON.stringify({
          error: 'API key not configured',
          message: `The ${apiKeyName} environment variable is not set or is invalid. Please configure it in your environment.`,
          details: {
            provider,
            keyName: apiKeyName,
            keySet: !!apiKeyValue,
            keyLength: apiKeyValue.length,
            isDev: process.env.NODE_ENV === 'development',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }, // Return 200 with error details instead of 404
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        message: `${provider} API key is configured`,
        isDev: process.env.NODE_ENV === 'development',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error checking API key:', error);
    return new Response(
      JSON.stringify({
        error: 'Server error checking API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
