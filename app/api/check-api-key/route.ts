import { PROVIDERS } from '@/lib/ai/providers';
import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await request.json();

    let apiKeyConfigured = false;

    // Only support OpenAI now
    if (provider === PROVIDERS.OPENAI) {
      apiKeyConfigured = !!process.env.OPENAI_API_KEY;
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
