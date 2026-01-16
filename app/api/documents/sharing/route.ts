import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  userDocuments,
  documentShareUser,
  documentShareOrg,
  user as userTable,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Get sharing settings for a document
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, documentId),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    // Get user-level shares
    const userShares = await db
      .select({
        id: documentShareUser.id,
        sharedWithId: documentShareUser.sharedWithId,
        permission: documentShareUser.permission,
        createdAt: documentShareUser.createdAt,
        expiresAt: documentShareUser.expiresAt,
        email: userTable.email,
      })
      .from(documentShareUser)
      .leftJoin(userTable, eq(userTable.id, documentShareUser.sharedWithId))
      .where(eq(documentShareUser.documentId, documentId));

    // Get org-level shares
    const orgShares = await db
      .select()
      .from(documentShareOrg)
      .where(eq(documentShareOrg.documentId, documentId));

    return NextResponse.json({
      documentId,
      userShares: userShares.map((share) => ({
        id: share.id,
        sharedWithId: share.sharedWithId,
        sharedWithEmail: share.email,
        permission: share.permission,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      })),
      orgShares: orgShares.map((share) => ({
        id: share.id,
        orgId: share.orgId,
        permission: share.permission,
        createdAt: share.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching sharing settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sharing settings' },
      { status: 500 },
    );
  }
}

// POST - Share document with users or organization
export async function POST(request: NextRequest) {
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

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const { documentId, shareWithUsers, shareWithOrg, permission, expiresAt } =
      body as {
        documentId: string;
        shareWithUsers?: string[]; // Array of user IDs
        shareWithOrg?: boolean;
        permission: 'view' | 'edit' | 'comment';
        expiresAt?: string;
      };

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 },
      );
    }

    if (!permission || !['view', 'edit', 'comment'].includes(permission)) {
      return NextResponse.json(
        { error: 'Valid permission is required (view, edit, or comment)' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, documentId),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    const results: {
      userShares: string[];
      orgShare?: boolean;
      errors: string[];
    } = {
      userShares: [],
      errors: [],
    };

    // Share with individual users
    if (shareWithUsers && shareWithUsers.length > 0) {
      for (const userId of shareWithUsers) {
        try {
          // Check if user exists
          const [targetUser] = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, userId));

          if (!targetUser) {
            results.errors.push(`User ${userId} not found`);
            continue;
          }

          // Create or update share
          await db
            .insert(documentShareUser)
            .values({
              documentId,
              sharedById: session.user.id,
              sharedWithId: userId,
              permission,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            })
            .onConflictDoUpdate({
              target: [
                documentShareUser.documentId,
                documentShareUser.sharedWithId,
              ],
              set: {
                permission,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
              },
            });

          results.userShares.push(userId);
        } catch (error) {
          console.error(`Error sharing with user ${userId}:`, error);
          results.errors.push(`Failed to share with user ${userId}`);
        }
      }
    }

    // Share with organization
    if (shareWithOrg && userOrgId) {
      try {
        await db
          .insert(documentShareOrg)
          .values({
            documentId,
            orgId: userOrgId,
            sharedById: session.user.id,
            permission,
          })
          .onConflictDoUpdate({
            target: [documentShareOrg.documentId, documentShareOrg.orgId],
            set: {
              permission,
            },
          });

        results.orgShare = true;
      } catch (error) {
        console.error('Error sharing with organization:', error);
        results.errors.push('Failed to share with organization');
      }
    } else if (shareWithOrg && !userOrgId) {
      results.errors.push('User is not part of an organization');
    }

    return NextResponse.json({
      message: 'Document shared successfully',
      results,
    });
  } catch (error) {
    console.error('Error sharing document:', error);
    return NextResponse.json(
      { error: 'Failed to share document' },
      { status: 500 },
    );
  }
}

// DELETE - Revoke document sharing
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const { documentId, shareId, shareType } = body as {
      documentId: string;
      shareId: string;
      shareType: 'user' | 'org';
    };

    if (!documentId || !shareId || !shareType) {
      return NextResponse.json(
        { error: 'documentId, shareId, and shareType are required' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, documentId),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    // Revoke share
    if (shareType === 'user') {
      await db
        .delete(documentShareUser)
        .where(eq(documentShareUser.id, shareId));
    } else if (shareType === 'org') {
      await db.delete(documentShareOrg).where(eq(documentShareOrg.id, shareId));
    }

    return NextResponse.json({
      message: 'Share revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking share:', error);
    return NextResponse.json(
      { error: 'Failed to revoke share' },
      { status: 500 },
    );
  }
}

// PATCH - Update share permissions
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const { documentId, shareId, shareType, permission } = body as {
      documentId: string;
      shareId: string;
      shareType: 'user' | 'org';
      permission: 'view' | 'edit' | 'comment';
    };

    if (!documentId || !shareId || !shareType || !permission) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 },
      );
    }

    if (!['view', 'edit', 'comment'].includes(permission)) {
      return NextResponse.json(
        { error: 'Invalid permission value' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, documentId),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    // Update permission
    if (shareType === 'user') {
      await db
        .update(documentShareUser)
        .set({ permission })
        .where(eq(documentShareUser.id, shareId));
    } else if (shareType === 'org') {
      await db
        .update(documentShareOrg)
        .set({ permission })
        .where(eq(documentShareOrg.id, shareId));
    }

    return NextResponse.json({
      message: 'Permission updated successfully',
    });
  } catch (error) {
    console.error('Error updating permission:', error);
    return NextResponse.json(
      { error: 'Failed to update permission' },
      { status: 500 },
    );
  }
}
