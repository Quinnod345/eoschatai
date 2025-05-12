import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { PROVIDERS, DEFAULT_PROVIDER } from '@/lib/ai/providers';

// Global override flag that can be toggled during runtime
// This is intentionally stored here, outside of the request handler
// so it persists between requests
let OVERRIDE_PROVIDER = true;
let FORCE_PROVIDER = PROVIDERS.OPENAI;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Check if we should get the status or toggle it
    const action = searchParams.get('action');

    if (action === 'toggle') {
      // Toggle the override flag
      OVERRIDE_PROVIDER = !OVERRIDE_PROVIDER;
      console.log(
        `Provider override is now ${OVERRIDE_PROVIDER ? 'ENABLED' : 'DISABLED'}`,
      );
    }

    if (action === 'set') {
      // Set a specific provider as the forced provider
      const provider = searchParams.get('provider');
      if (provider === PROVIDERS.XAI || provider === PROVIDERS.OPENAI) {
        FORCE_PROVIDER = provider;
        console.log(`Force provider set to: ${FORCE_PROVIDER}`);
      }
    }

    // Get cookies asynchronously
    const cookieStore = await cookies();
    const providerCookie = cookieStore.get('ai-provider');

    return new Response(
      JSON.stringify({
        success: true,
        overrideEnabled: OVERRIDE_PROVIDER,
        forcedProvider: FORCE_PROVIDER,
        currentSelectedProvider: providerCookie?.value || DEFAULT_PROVIDER,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in provider-override:', error);
    return new Response(
      JSON.stringify({
        error: 'Server error in provider override endpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
