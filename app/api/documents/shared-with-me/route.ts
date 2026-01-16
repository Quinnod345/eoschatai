import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  userDocuments,
  documentShareUser,
  documentShareOrg,
  user as userTable,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    // Get documents shared directly with user
    const userSharedDocsRaw = await db
      .select({
        documentId: documentShareUser.documentId,
        document: userDocuments,
        permission: documentShareUser.permission,
        sharedBy: userTable.email,
        sharedAt: documentShareUser.createdAt,
      })
      .from(documentShareUser)
      .innerJoin(
        userDocuments,
        eq(userDocuments.id, documentShareUser.documentId),
      )
      .leftJoin(userTable, eq(userTable.id, documentShareUser.sharedById))
      .where(eq(documentShareUser.sharedWithId, session.user.id));

    const userSharedDocs = userSharedDocsRaw.map((doc) => ({
      ...doc,
      shareType: 'user' as const,
    }));

    // Get documents shared with user's organization
    let orgSharedDocs: Array<
      (typeof userSharedDocsRaw)[number] & { shareType: 'org' }
    > = [];
    if (userOrgId) {
      const orgSharedDocsRaw = await db
        .select({
          documentId: documentShareOrg.documentId,
          document: userDocuments,
          permission: documentShareOrg.permission,
          sharedBy: userTable.email,
          sharedAt: documentShareOrg.createdAt,
        })
        .from(documentShareOrg)
        .innerJoin(
          userDocuments,
          eq(userDocuments.id, documentShareOrg.documentId),
        )
        .leftJoin(userTable, eq(userTable.id, documentShareOrg.sharedById))
        .where(eq(documentShareOrg.orgId, userOrgId));

      orgSharedDocs = orgSharedDocsRaw.map((doc) => ({
        ...doc,
        shareType: 'org' as const,
      }));
    }

    // Combine and deduplicate
    const allSharedDocs = [...userSharedDocs, ...orgSharedDocs];
    const uniqueDocs = Array.from(
      new Map(allSharedDocs.map((doc) => [doc.documentId, doc])).values(),
    );

    return NextResponse.json({
      documents: uniqueDocs.map((doc) => ({
        id: doc.document.id,
        fileName: doc.document.fileName,
        fileSize: doc.document.fileSize,
        fileType: doc.document.fileType,
        category: doc.document.category,
        uploadedAt: doc.document.createdAt,
        permission: doc.permission,
        sharedBy: doc.sharedBy,
        sharedAt: doc.sharedAt,
        shareType: doc.shareType,
      })),
    });
  } catch (error) {
    console.error('Error fetching shared documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared documents' },
      { status: 500 },
    );
  }
}
