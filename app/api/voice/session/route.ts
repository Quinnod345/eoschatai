import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { buildVoicePrompt } from '@/lib/ai/voice-prompts';
import { getPersonaProfileById } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { persona } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/utils/secure-logger';

const logger = createLogger('VoiceSessionAPI');

// This endpoint creates ephemeral tokens for browser-based Realtime API connections
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Voice service not configured' },
        { status: 500 },
      );
    }

    // Parse request body to get persona and profile IDs
    let selectedPersonaId: string | undefined;
    let selectedProfileId: string | undefined;
    let chatId: string | undefined;

    try {
      const body = await request.json();
      selectedPersonaId = body.selectedPersonaId;
      selectedProfileId = body.selectedProfileId;
      chatId = body.chatId;
    } catch (error) {
      // If no body or invalid JSON, use defaults
      logger.debug('No request body provided, using defaults');
    }

    // Create ephemeral token for browser WebRTC connection
    const response = await fetch(
      'https://api.openai.com/v1/realtime/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy',
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create session:', error);
      console.error('Response status:', response.status);
      console.error('Response headers:', response.headers);
      return NextResponse.json(
        { error: 'Failed to create voice session', details: error },
        { status: response.status },
      );
    }

    const data = await response.json();

    // Log session creation (sanitized - no secrets)
    logger.info('OpenAI session created', {
      sessionId: data.id,
      hasClientSecret: !!(data.client_secret?.value || data.client_secret),
      expiresAt: data.client_secret?.expires_at || data.expires_at,
    });

    // Extract the client_secret value from the object
    const clientSecretValue = data.client_secret?.value || data.client_secret;

    // Generate voice-optimized prompt with persona and profile context
    const instructions = await buildVoicePrompt({
      role: session.user.type,
      personaId: selectedPersonaId,
      profileId: selectedProfileId,
      userId: session.user.id,
      isVoiceMode: true,
    });

    // Get persona and profile names for display
    let personaName: string | undefined;
    let profileName: string | undefined;

    if (selectedPersonaId) {
      if (selectedPersonaId === 'eos-implementer') {
        personaName = 'EOS Implementer';
      } else {
        // Fetch persona from database
        const [personaData] = await db
          .select()
          .from(persona)
          .where(eq(persona.id, selectedPersonaId))
          .limit(1);
        personaName = personaData?.name;
      }
    }

    if (selectedProfileId) {
      const profile = await getPersonaProfileById({ id: selectedProfileId });
      profileName = profile?.name;
    }

    // Return session details for client connection
    return NextResponse.json({
      id: data.id,
      client_secret: clientSecretValue,
      expires_at: data.client_secret?.expires_at || data.expires_at,
      instructions, // Send the generated system prompt to the client
      personaName,
      profileName,
      chatId, // Return the chat ID for the client to use
    });
  } catch (error) {
    console.error('Voice session error:', error);
    return NextResponse.json(
      { error: 'Failed to create voice session' },
      { status: 500 },
    );
  }
}
