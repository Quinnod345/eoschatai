import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { generateUUID } from '@/lib/utils';
import { saveChat, getChatById } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  console.log('[send-to-chat] Request received');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.log('[send-to-chat] No session/user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, transcript, speakers, segments, summary } = body;
    console.log('[send-to-chat] Request body:', {
      hasChatId: !!chatId,
      hasTranscript: !!transcript,
      speakers,
      segmentCount: segments?.length,
      hasSummary: !!summary,
    });

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript required' },
        { status: 400 },
      );
    }

    // Always create a new chat - use provided chatId or generate one
    const finalChatId = chatId || generateUUID();
    console.log('[send-to-chat] Creating new chat with ID:', finalChatId);

    // Extract first sentence for title
    const firstSentence =
      transcript.match(/^[^.!?]+[.!?]?/)?.[0] || '🎙️ Voice Recording';
    const title =
      firstSentence.length > 60
        ? `${firstSentence.substring(0, 60)}...`
        : firstSentence;

    console.log('[send-to-chat] Creating new chat:', {
      chatId: finalChatId,
      userId: session.user.id,
      title,
    });

    try {
      const savedChat = await saveChat({
        id: finalChatId,
        userId: session.user.id,
        title,
        visibility: 'private',
        metadata: {
          isRecording: true,
        },
      });

      if (!savedChat) {
        console.error('[send-to-chat] saveChat returned null/undefined');
        throw new Error('Failed to save chat - no data returned');
      }

      console.log('[send-to-chat] Chat saved successfully:', savedChat);
    } catch (saveChatError) {
      console.error('[send-to-chat] Failed to save chat:', saveChatError);
      throw saveChatError;
    }

    // Verify the chat exists with retries
    let chatExists = false;
    const maxRetries = 20;
    const retryDelay = 300; // ms

    for (let i = 0; i < maxRetries; i++) {
      try {
        const verifyChat = await getChatById({ id: finalChatId });
        if (verifyChat && verifyChat.id === finalChatId) {
          chatExists = true;
          console.log(`[send-to-chat] Chat verified on attempt ${i + 1}`);
          break;
        }
      } catch (verifyError) {
        console.error(
          `[send-to-chat] Verify attempt ${i + 1} failed:`,
          verifyError,
        );
      }
      console.log(
        `[send-to-chat] Chat not found, retry ${i + 1}/${maxRetries}`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    if (!chatExists) {
      console.error(
        '[send-to-chat] Chat creation failed - not found after retries',
        {
          chatId: finalChatId,
        },
      );
      return NextResponse.json(
        { error: 'Failed to create chat' },
        { status: 500 },
      );
    }

    console.log('[send-to-chat] Successfully created chat:', {
      chatId: finalChatId,
    });

    return NextResponse.json({
      success: true,
      chatId: finalChatId,
      chatCreated: true,
      transcript: transcript,
      speakers,
      segments,
      summary,
      redirectUrl: `/chat/${finalChatId}`,
      shouldRefreshSidebar: true,
    });
  } catch (error: any) {
    console.error('send-to-chat error', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
