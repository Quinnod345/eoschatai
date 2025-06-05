import { PROVIDERS } from '@/lib/ai/providers';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json();

    let apiKeyConfigured = false;
    let apiKeyName = '';
    let apiKeyValue = '';

    // Only support OpenAI now
    if (provider === PROVIDERS.OPENAI) {
      apiKeyConfigured = !!process.env.OPENAI_API_KEY;
      apiKeyName = 'OPENAI_API_KEY';
      apiKeyValue = process.env.OPENAI_API_KEY || '';
    } else {
      return Response.json({
        configured: false,
        provider,
        error: 'Unsupported provider. Only OpenAI is supported.',
      });
    }

    return Response.json({
      configured: apiKeyConfigured,
      provider,
      keyName: apiKeyName,
      hasValue: !!apiKeyValue,
      keyLength: apiKeyValue.length,
    });
  } catch (error) {
    console.error('Error checking API key:', error);
    return Response.json(
      {
        configured: false,
        error: 'Failed to check API key configuration',
      },
      { status: 500 },
    );
  }
}
