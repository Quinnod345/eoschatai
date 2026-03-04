import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { saveMessages, saveChat } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { getAccessContext } from '@/lib/entitlements';

// This endpoint saves voice conversation messages to the database
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const body = await request.json();
    console.log('Voice messages API called with:', {
      chatId: body.chatId,
      hasUserMessage: !!body.userMessage,
      hasAssistantMessage: !!body.assistantMessage,
      userMessageContent: body.userMessage?.content?.substring(0, 50),
      assistantMessageContent: body.assistantMessage?.content?.substring(0, 50),
    });
    let {
      chatId,
      userMessage,
      assistantMessage,
      selectedPersonaId,
      selectedProfileId,
      provider = 'openai',
    } = body;
    let personaWarning:
      | {
          code: 'PERSONA_FALLBACK_TO_DEFAULT';
          message: string;
          requiredPlan: 'pro';
          feature: 'personas.custom';
          action: 'open_premium_modal';
          selectedPersonaId?: string;
          selectedProfileId?: string;
        }
      | undefined;

    if (selectedPersonaId || selectedProfileId) {
      const accessContext = await getAccessContext(session.user.id);
      if (!accessContext.entitlements.features.personas.custom) {
        personaWarning = {
          code: 'PERSONA_FALLBACK_TO_DEFAULT',
          message:
            'AI personas are a Pro feature. Message saved with the default assistant.',
          requiredPlan: 'pro',
          feature: 'personas.custom',
          action: 'open_premium_modal',
          selectedPersonaId,
          selectedProfileId,
        };
        selectedPersonaId = undefined;
        selectedProfileId = undefined;
      }
    }

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required', code: 'CHAT_ID_REQUIRED' },
        { status: 400 },
      );
    }

    // Track if we created a new chat
    let chatCreated = false;

    // Create chat if it doesn't exist (first message)
    if (userMessage && !assistantMessage) {
      try {
        // Generate a proper title from the first user message
        const { generateTitleFromUserMessage } = await import(
          '@/app/(chat)/actions'
        );
        const title = await generateTitleFromUserMessage({
          message: {
            id: userMessage.id,
            role: 'user',
            content: userMessage.content,
            createdAt: new Date(userMessage.timestamp),
            parts: [{ type: 'text', text: userMessage.content }],
          } as any,
        });

        await saveChat({
          id: chatId,
          userId: session.user.id,
          title: title || '🎤 Voice Chat',
          visibility: 'private', // Default to private for voice chats
          personaId: selectedPersonaId,
          profileId: selectedProfileId,
          metadata: { isVoiceChat: true } as any,
        });
        console.log(
          'Voice chat created successfully with title:',
          title,
          'chatId:',
          chatId,
        );
        chatCreated = true;
      } catch (error) {
        // Chat might already exist, which is fine
        console.log('Chat may already exist:', error);
      }
    }

    const messages: any[] = [];

    // Save user message
    if (userMessage?.content) {
      const userMsg = {
        id: userMessage.id || generateUUID(),
        chatId,
        role: 'user',
        parts: [{ type: 'text', text: userMessage.content }],
        attachments: [],
        createdAt: new Date(userMessage.timestamp || Date.now()),
        provider,
      };
      console.log('User message to save:', JSON.stringify(userMsg, null, 2));
      messages.push(userMsg);
    } else if (userMessage) {
      console.log('Skipping user message with empty content:', userMessage);
    }

    // Save assistant message
    if (assistantMessage?.content) {
      const assistantMsg = {
        id: assistantMessage.id || generateUUID(),
        chatId,
        role: 'assistant',
        parts: [{ type: 'text', text: assistantMessage.content }],
        attachments: [],
        createdAt: new Date(assistantMessage.timestamp || Date.now()),
        provider,
      };
      console.log(
        'Assistant message to save:',
        JSON.stringify(assistantMsg, null, 2),
      );
      messages.push(assistantMsg);
    } else if (assistantMessage) {
      console.log(
        'Skipping assistant message with empty content:',
        assistantMessage,
      );
    }

    // Save messages to database
    if (messages.length > 0) {
      console.log('Saving messages to database:', messages);
      try {
        await saveMessages({ messages });
        console.log('Messages saved successfully');
      } catch (saveError) {
        console.error('Error saving messages:', saveError);
        throw saveError;
      }
    }

    return NextResponse.json({
      success: true,
      savedCount: messages.length,
      chatCreated,
      chatId,
      warning: personaWarning,
    });
  } catch (error) {
    console.error('Voice message save error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown',
    });

    // Check for specific database errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('duplicate key') ||
      errorMessage.includes('violates unique constraint')
    ) {
      return NextResponse.json(
        {
          error: 'Message already exists',
          code: 'VOICE_MESSAGE_DUPLICATE',
          details: errorMessage,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to save voice messages',
        code: 'VOICE_MESSAGES_SAVE_FAILED',
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
