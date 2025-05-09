import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(request: Request) {
  const session = await auth();

  // Extract the id from the URL
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json(
      { error: 'Document ID is required' },
      { status: 400 },
    );
  }

  try {
    // First get the document to verify ownership and get file URL
    const documents = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, id),
          eq(userDocuments.userId, session.user.id),
        ),
      )
      .limit(1);

    const document = documents[0];

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or not authorized' },
        { status: 404 },
      );
    }

    // Delete file from Vercel Blob
    try {
      await del(document.fileUrl);
    } catch (blobError) {
      console.error('Failed to delete blob:', blobError);
      // Continue with database deletion even if blob deletion fails
    }

    // Delete document from database
    await db.delete(userDocuments).where(eq(userDocuments.id, id));

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 },
    );
  }
}
