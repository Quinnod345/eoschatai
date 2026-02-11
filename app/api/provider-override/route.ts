import { PROVIDERS } from '@/lib/ai/providers';
import { requireAdmin } from '@/lib/auth/admin';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const adminError = await requireAdmin();
    if (adminError) return adminError;

    const { provider } = await request.json();

    // Validate the provider
    if (provider !== PROVIDERS.OPENAI) {
      return Response.json(
        {
          success: false,
          error: 'Invalid provider. Only OpenAI is supported.',
        },
        { status: 400 },
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, error: 'OpenAI API key is not configured' },
        { status: 500 },
      );
    }

    console.log(`Provider override set to: ${provider}`);

    return Response.json({
      success: true,
      provider: provider,
      message: `Provider set to ${provider === PROVIDERS.OPENAI ? 'OpenAI' : 'Unknown'}`,
    });
  } catch (error) {
    console.error('Error in provider override:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  return Response.json({
    success: true,
    provider: PROVIDERS.OPENAI,
    message: 'Using OpenAI provider',
  });
}
