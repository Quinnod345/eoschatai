import { auth } from '@/app/(auth)/auth';
import { getChatById, saveFeedback, getUserFeedback } from '@/lib/db/queries';

export async function POST(request: Request) {
  try {
    const {
      chatId,
      messageId,
      type,
      category,
      description,
    }: {
      chatId: string;
      messageId: string;
      type: 'up' | 'down';
      category?: string;
      description?: string;
    } = await request.json();

    if (!chatId || !messageId || !type) {
      return new Response('chatId, messageId, and type are required', {
        status: 400,
      });
    }

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await saveFeedback({
      chatId,
      messageId,
      userId: session.user.id,
      isPositive: type === 'up',
      category: category as
        | 'accuracy'
        | 'helpfulness'
        | 'tone'
        | 'length'
        | 'clarity'
        | 'other'
        | undefined,
      description,
    });

    return new Response('Feedback saved', { status: 200 });
  } catch (error) {
    console.error('Failed to save feedback:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const feedback = await getUserFeedback({ userId: session.user.id });

    return Response.json(feedback, { status: 200 });
  } catch (error) {
    console.error('Failed to get user feedback:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
