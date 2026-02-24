import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { saveMessages, saveChat } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

// This endpoint saves an entire voice conversation at once
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[Batch Save] Request received:', {
      chatId: body.chatId,
      messageCount: body.messages?.length || 0,
      hasPersona: !!body.selectedPersonaId,
    });

    const {
      chatId,
      messages,
      selectedPersonaId,
      selectedProfileId,
      provider = 'openai',
    } = body;

    if (!chatId || !messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Chat ID and messages are required' },
        { status: 400 },
      );
    }

    // Generate title from first user message
    const firstUserMessage = messages.find((m: any) => m.role === 'user');
    let title = '🎤 Voice Chat';

    if (firstUserMessage) {
      try {
        const { generateTitleFromUserMessage } = await import(
          '@/app/(chat)/actions'
        );
        const generatedTitle = await generateTitleFromUserMessage({
          message: {
            id: firstUserMessage.id,
            role: 'user',
            content: firstUserMessage.content,
            createdAt: new Date(firstUserMessage.timestamp),
            parts: [{ type: 'text', text: firstUserMessage.content }],
          } as any,
        });

        if (generatedTitle) {
          title = generatedTitle;
        }
      } catch (error) {
        console.error('[Batch Save] Error generating title:', error);
      }
    }

    // Execute chat creation and message saving in sequence with verification
    console.log('[Batch Save] Starting transaction for chat:', chatId);

    let dbMessages: any[] = [];

    try {
      // Step 1: Create the chat
      console.log('[Batch Save] Step 1: Creating chat with ID:', chatId);
      await saveChat({
        id: chatId,
        userId: session.user.id,
        title,
        visibility: 'private',
        personaId: selectedPersonaId,
        profileId: selectedProfileId,
        metadata: { isVoiceChat: true } as any,
      });

      console.log('[Batch Save] Chat created successfully');

      // Step 2: Verify the chat was created before proceeding
      const { getChatById } = await import('@/lib/db/queries');
      const verifyChat = await getChatById({ id: chatId });

      if (!verifyChat) {
        throw new Error('Chat was not found after creation');
      }

      console.log('[Batch Save] Chat verified:', {
        chatId: verifyChat.id,
        title: verifyChat.title,
      });

      // Step 3: Prepare and save messages
      // Sort messages by timestamp to ensure proper order
      const sortedMessages = [...messages].sort((a, b) => {
        const timeA = a.timestamp || Date.now();
        const timeB = b.timestamp || Date.now();
        return timeA - timeB;
      });

      // Ensure no assistant message has timestamp before its user message
      for (let i = 0; i < sortedMessages.length; i++) {
        if (sortedMessages[i].role === 'assistant' && i > 0) {
          // Find the most recent user message
          let lastUserIndex = -1;
          for (let j = i - 1; j >= 0; j--) {
            if (sortedMessages[j].role === 'user') {
              lastUserIndex = j;
              break;
            }
          }

          if (lastUserIndex >= 0) {
            const userTime =
              sortedMessages[lastUserIndex].timestamp || Date.now();
            const assistantTime = sortedMessages[i].timestamp || Date.now();

            if (assistantTime <= userTime) {
              console.log(
                '[Batch Save] Fixing assistant timestamp to be after user message',
              );
              sortedMessages[i].timestamp = userTime + 10;
            }
          }
        }
      }

      // Re-sort after fixing timestamps
      sortedMessages.sort((a, b) => {
        const timeA = a.timestamp || Date.now();
        const timeB = b.timestamp || Date.now();
        return timeA - timeB;
      });

      dbMessages = sortedMessages.map((msg: any, index: number) => ({
        id: msg.id || generateUUID(),
        chatId,
        role: msg.role,
        parts: [{ type: 'text', text: msg.content }],
        attachments: [],
        // Use the message timestamp, add small increment to ensure uniqueness
        createdAt: new Date(msg.timestamp + index),
        provider,
      }));

      console.log(
        '[Batch Save] Step 3: Saving messages (sorted by timestamp):',
        {
          count: dbMessages.length,
          order: dbMessages.map((m) => ({ role: m.role, time: m.createdAt })),
        },
      );

      await saveMessages({ messages: dbMessages });

      // Step 4: Final verification
      const finalVerification = await getChatById({ id: chatId });

      if (!finalVerification) {
        throw new Error('Chat not found during final verification');
      }

      console.log('[Batch Save] Transaction completed successfully:', {
        chatId: finalVerification.id,
        title: finalVerification.title,
        messageCount: dbMessages.length,
      });

      // Add small delay to ensure database consistency
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error('[Batch Save] Transaction failed:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      chatId,
      title,
      savedCount: dbMessages.length,
    });
  } catch (error) {
    console.error('[Batch Save] Error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Failed to save voice conversation',
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
