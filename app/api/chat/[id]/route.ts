import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { chat } from '@/lib/db/schema';
import { getDisplayTitle } from '@/lib/utils/chat-utils';
import { eq, and } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Fetch the chat
    const existingChat = await db
      .select()
      .from(chat)
      .where(eq(chat.id, id))
      .limit(1);

    if (existingChat.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const foundChat = existingChat[0];

    // Check if user owns the chat or if it's public
    if (
      foundChat.userId !== session.user.id &&
      foundChat.visibility !== 'public'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      ...foundChat,
      title: getDisplayTitle(foundChat.title)
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    console.log('PERSONA_SWITCH: Unauthorized - no session user');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { personaId, profileId } = body;

    console.log('PERSONA_SWITCH: Starting persona/profile update', {
      chatId: id,
      userId: session.user.id,
      personaId: personaId,
      profileId: profileId,
      timestamp: new Date().toISOString(),
    });

    // First, check if the chat exists
    const existingChat = await db
      .select()
      .from(chat)
      .where(eq(chat.id, id))
      .limit(1);

    console.log('PERSONA_SWITCH: Chat lookup result', {
      chatId: id,
      found: existingChat.length > 0,
      chatData: existingChat[0] || null,
    });

    if (existingChat.length === 0) {
      console.log('PERSONA_SWITCH: Chat not found in database', {
        chatId: id,
        userId: session.user.id,
      });
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const foundChat = existingChat[0];

    // Check if user owns the chat
    if (foundChat.userId !== session.user.id) {
      console.log('PERSONA_SWITCH: User does not own chat', {
        chatId: id,
        chatUserId: foundChat.userId,
        requestUserId: session.user.id,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log(
      'PERSONA_SWITCH: Chat ownership verified, updating persona/profile',
      {
        chatId: id,
        currentPersonaId: foundChat.personaId,
        currentProfileId: foundChat.profileId,
        currentTitle: foundChat.title,
        newPersonaId: personaId,
        newProfileId: profileId,
        isCurrentlyEOSImplementer: foundChat.title.includes('|||EOS_META:') && foundChat.title.includes('"persona":"eos-implementer"'),
      },
    );

    // Prepare update data
    const updateData: { personaId?: string | null; profileId?: string | null; title?: string } =
      {};

    // Handle title updates for EOS Implementer metadata
    let titleUpdate: string | undefined = undefined;
    let isEOSImplementer = false;

    // Check if this is an EOS Implementer update (either setting persona or updating profile for existing EOS Implementer)
    const isCurrentlyEOSImplementer = foundChat.title.includes('|||EOS_META:') && 
      foundChat.title.includes('"persona":"eos-implementer"');
    
    const isSettingEOSPersona = personaId === 'eos-implementer' || 
      personaId === '00000000-0000-0000-0000-000000000001';

    isEOSImplementer = isSettingEOSPersona || (isCurrentlyEOSImplementer && !('personaId' in body));

    // Only update fields that are provided in the request
    if ('personaId' in body) {
      // Handle hardcoded EOS implementer persona - store as null
      if (isSettingEOSPersona) {
        updateData.personaId = null;
        
        // Update title with EOS metadata
        const currentTitle = foundChat.title.includes('|||EOS_META:') 
          ? foundChat.title.split('|||EOS_META:')[0] 
          : foundChat.title;
        const metadata = {
          persona: 'eos-implementer',
          profile: profileId || null
        };
        titleUpdate = `${currentTitle}|||EOS_META:${JSON.stringify(metadata)}`;
      } else {
        updateData.personaId = personaId || null;
        
        // Remove EOS metadata from title if switching away from EOS Implementer
        if (foundChat.title.includes('|||EOS_META:')) {
          titleUpdate = foundChat.title.split('|||EOS_META:')[0];
        }
      }
    }
    if ('profileId' in body) {
      // If this is an EOS Implementer chat, handle metadata
      if (isEOSImplementer) {
        updateData.profileId = null;
        
        // Update the metadata with new profile - handle both new and existing metadata
        const currentTitle = foundChat.title.includes('|||EOS_META:') 
          ? foundChat.title.split('|||EOS_META:')[0] 
          : foundChat.title;
        const metadata = {
          persona: 'eos-implementer',
          profile: profileId || null
        };
        titleUpdate = `${currentTitle}|||EOS_META:${JSON.stringify(metadata)}`;
      } else {
        // For regular personas, validate that profileId is a UUID or null
        if (profileId && !profileId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
          // Invalid UUID format, set to null
          console.warn('PERSONA_SWITCH: Invalid UUID format for profileId, setting to null', {
            profileId,
            chatId: id
          });
          updateData.profileId = null;
        } else {
          updateData.profileId = profileId || null;
        }
      }
    }

    // Add title update to updateData if needed
    if (titleUpdate !== undefined) {
      updateData.title = titleUpdate;
    }

    console.log('PERSONA_SWITCH: Final update data before database call', {
      chatId: id,
      updateData,
      isEOSImplementer,
      titleUpdate
    });

    // Update the chat with the new persona and/or profile
    const [updatedChat] = await db
      .update(chat)
      .set(updateData)
      .where(and(eq(chat.id, id), eq(chat.userId, session.user.id)))
      .returning();

    console.log('PERSONA_SWITCH: Update completed', {
      chatId: id,
      success: !!updatedChat,
      updatedPersonaId: updatedChat?.personaId,
      updatedProfileId: updatedChat?.profileId,
      timestamp: new Date().toISOString(),
    });

    if (!updatedChat) {
      console.log('PERSONA_SWITCH: Update failed - no chat returned', {
        chatId: id,
        userId: session.user.id,
      });
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    console.log('PERSONA_SWITCH: Successfully updated chat persona/profile', {
      chatId: id,
      personaId: updatedChat.personaId,
      profileId: updatedChat.profileId,
      userId: session.user.id,
    });

    return NextResponse.json(updatedChat);
  } catch (error) {
    console.error('PERSONA_SWITCH: Error updating chat:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      chatId: (await params).id,
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 },
    );
  }
}
