import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  userDocuments,
  documentShareUser,
  documentShareOrg,
  user as userTable,
} from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's orgId from database
    const [currentUser] = await db
      .select({ orgId: userTable.orgId })
      .from(userTable)
      .where(eq(userTable.id, session.user.id));
    const userOrgId = currentUser?.orgId;

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 },
      );
    }

    // Fetch the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(eq(userDocuments.id, documentId));

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // Check if user owns the document
    const isOwner = document.userId === session.user.id;

    // Check if document is shared with user
    let hasAccess = isOwner;

    if (!isOwner) {
      // Check user-level sharing
      const [userShare] = await db
        .select()
        .from(documentShareUser)
        .where(
          and(
            eq(documentShareUser.documentId, documentId),
            eq(documentShareUser.sharedWithId, session.user.id),
          ),
        );

      if (userShare) {
        hasAccess = true;
      } else {
        // Check org-level sharing if user is in an org
        if (userOrgId) {
          const [orgShare] = await db
            .select()
            .from(documentShareOrg)
            .where(
              and(
                eq(documentShareOrg.documentId, documentId),
                eq(documentShareOrg.orgId, userOrgId),
              ),
            );

          if (orgShare) {
            hasAccess = true;
          }
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to access this document' },
        { status: 403 },
      );
    }

    // Fetch the file from Vercel Blob
    try {
      const response = await fetch(document.fileUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch file from storage');
      }

      // Get the file blob
      const blob = await response.blob();

      // Create response with appropriate headers
      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': document.fileType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(document.fileName)}"`,
          'Content-Length': String(document.fileSize),
        },
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      return NextResponse.json(
        { error: 'Failed to download document' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error in document download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
