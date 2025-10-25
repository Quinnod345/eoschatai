import { auth } from '@/app/(auth)/auth';
import { getChatById, saveFeedback, getUserFeedback } from '@/lib/db/queries';
import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/errors/api-wrapper';

export const POST = withErrorHandler(async (request: NextRequest) => {
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
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const feedback = await getUserFeedback({ userId: session.user.id });

  return Response.json(feedback, { status: 200 });
});
