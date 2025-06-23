import { NextResponse } from 'next/server';
import { getChatById } from '@/lib/db/queries';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  try {
    const chat = await getChatById({ id: params.id });

    if (chat) {
      return NextResponse.json({ exists: true, chat });
    } else {
      return NextResponse.json({ exists: false });
    }
  } catch (error) {
    console.error('[Chat Verify] Error:', error);
    return NextResponse.json({ exists: false, error: 'Failed to verify chat' });
  }
}
