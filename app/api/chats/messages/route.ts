import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  if (!chatId) {
    return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
  }

  try {
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (chat.userId !== session.user.id && chat.visibility !== 'public') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await getMessagesByChatId({ id: chatId });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[chats/messages] Failed to fetch messages', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 },
    );
  }
}



