import { type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { saveMessages } from '@/lib/db/queries';
import { z } from 'zod/v3';

const saveMessageSchema = z.object({
  chatId: z.string().min(1), // SDK 5: Accept any string ID, not just UUID
  messageId: z.string().min(1), // SDK 5: Accept any string ID, not just UUID
  message: z.object({
    id: z.string().min(1), // SDK 5: Accept any string ID, not just UUID
    role: z.enum(['assistant']),
    parts: z.array(z.any()),
    createdAt: z.coerce.date(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    
    console.log('[Save Message API] Received request body:', {
      chatId: body.chatId,
      messageId: body.messageId,
      messageIdType: typeof body.messageId,
      messageIdValue: body.messageId,
      role: body.message?.role,
      partsCount: body.message?.parts?.length,
      fullBody: JSON.stringify(body, null, 2).substring(0, 500),
    });
    
    const { chatId, messageId, message } = saveMessageSchema.parse(body);

    // Filter out data stream parts - only keep message content parts
    const contentParts = message.parts.filter((part: any) => {
      // Keep text and tool parts
      // SDK 5: Tool parts are named like 'tool-createDocument', 'tool-searchWeb', etc.
      // Exclude data stream parts (data-chat-status, data-event, data-*, step-start, etc.)
      const partType = part.type || '';
      
      // Include: text, tool-* (tool invocations)
      if (partType === 'text' || partType.startsWith('tool-')) {
        return true;
      }
      
      // Exclude: data-*, step-*, and other SDK 5 stream metadata
      return false;
    });

    console.log('[Save Message API] Filtered parts:', {
      originalPartsCount: message.parts.length,
      contentPartsCount: contentParts.length,
      originalTypes: message.parts.map((p: any) => p.type),
      contentTypes: contentParts.map((p: any) => p.type),
    });

    // SDK 5: Generate a proper UUID for the message if the ID isn't a UUID
    // The database requires UUID format
    const { randomUUID } = await import('crypto');
    const dbMessageId = messageId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) 
      ? messageId 
      : randomUUID();

    console.log('[Save Message API] Saving message:', {
      chatId,
      originalMessageId: messageId,
      dbMessageId,
      role: message.role,
      originalPartsCount: message.parts.length,
      contentPartsCount: contentParts.length,
      userId: session.user.id,
    });

    // Save the message to database
    await saveMessages({
      messages: [
        {
          id: dbMessageId,
          chatId: chatId,
          role: message.role,
          parts: contentParts,
          attachments: [],
          createdAt: message.createdAt,
          provider: 'openai', // Default provider
        },
      ],
    });

    console.log('[Save Message API] Message saved successfully:', messageId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Save Message API] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to save message',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

