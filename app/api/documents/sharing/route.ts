import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  userDocuments,
  documentShareUser,
  documentShareOrg,
  user as userTable,
} from '@/lib/db/schema';
import { isValidUuid, validateUuidField } from '@/lib/api/validation';
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

    const validatedDocumentId = validateUuidField(documentId, 'documentId');
    if (!validatedDocumentId.ok) {
      return NextResponse.json(
        { error: validatedDocumentId.error },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, validatedDocumentId.value),
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
      .where(eq(documentShareUser.documentId, validatedDocumentId.value));

    // Get org-level shares
    const orgShares = await db
      .select()
      .from(documentShareOrg)
      .where(eq(documentShareOrg.documentId, validatedDocumentId.value));

    return NextResponse.json({
      documentId: validatedDocumentId.value,
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

    let body: unknown;
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
        documentId?: string;
        shareWithUsers?: string[]; // Array of user IDs
        shareWithOrg?: boolean;
        permission?: 'view' | 'edit' | 'comment';
        expiresAt?: string;
      };

    const validatedDocumentId = validateUuidField(documentId, 'documentId');
    if (!validatedDocumentId.ok) {
      return NextResponse.json(
        { error: validatedDocumentId.error },
        { status: 400 },
      );
    }

    if (!permission || !['view', 'edit', 'comment'].includes(permission)) {
      return NextResponse.json(
        { error: 'Valid permission is required (view, edit, or comment)' },
        { status: 400 },
      );
    }

    if (
      shareWithUsers &&
      (!Array.isArray(shareWithUsers) ||
        shareWithUsers.some((userId) => !isValidUuid(userId)))
    ) {
      return NextResponse.json(
        { error: 'shareWithUsers must be an array of UUIDs' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, validatedDocumentId.value),
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
              documentId: validatedDocumentId.value,
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
            documentId: validatedDocumentId.value,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const { documentId, shareId, shareType } = body as {
      documentId?: string;
      shareId?: string;
      shareType?: 'user' | 'org';
    };

    const validatedDocumentId = validateUuidField(documentId, 'documentId');
    if (!validatedDocumentId.ok) {
      return NextResponse.json({ error: validatedDocumentId.error }, { status: 400 });
    }

    const validatedShareId = validateUuidField(shareId, 'shareId');
    if (!validatedShareId.ok) {
      return NextResponse.json({ error: validatedShareId.error }, { status: 400 });
    }

    if (!shareType) {
      return NextResponse.json(
        { error: 'shareType is required' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, validatedDocumentId.value),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    // Revoke share and ensure the share belongs to this document
    if (shareType === 'user') {
      const deleted = await db
        .delete(documentShareUser)
        .where(
          and(
            eq(documentShareUser.id, validatedShareId.value),
            eq(documentShareUser.documentId, validatedDocumentId.value),
          ),
        )
        .returning({ id: documentShareUser.id });

      if (deleted.length === 0) {
        return NextResponse.json({ error: 'Share not found' }, { status: 404 });
      }
    } else if (shareType === 'org') {
      const deleted = await db
        .delete(documentShareOrg)
        .where(
          and(
            eq(documentShareOrg.id, validatedShareId.value),
            eq(documentShareOrg.documentId, validatedDocumentId.value),
          ),
        )
        .returning({ id: documentShareOrg.id });

      if (deleted.length === 0) {
        return NextResponse.json({ error: 'Share not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json(
        { error: 'shareType must be user or org' },
        { status: 400 },
      );
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

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const { documentId, shareId, shareType, permission } = body as {
      documentId?: string;
      shareId?: string;
      shareType?: 'user' | 'org';
      permission?: 'view' | 'edit' | 'comment';
    };

    const validatedDocumentId = validateUuidField(documentId, 'documentId');
    if (!validatedDocumentId.ok) {
      return NextResponse.json({ error: validatedDocumentId.error }, { status: 400 });
    }

    const validatedShareId = validateUuidField(shareId, 'shareId');
    if (!validatedShareId.ok) {
      return NextResponse.json({ error: validatedShareId.error }, { status: 400 });
    }

    if (!shareType || !permission) {
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
          eq(userDocuments.id, validatedDocumentId.value),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    // Update permission and ensure the share belongs to this document
    if (shareType === 'user') {
      const updated = await db
        .update(documentShareUser)
        .set({ permission })
        .where(
          and(
            eq(documentShareUser.id, validatedShareId.value),
            eq(documentShareUser.documentId, validatedDocumentId.value),
          ),
        )
        .returning({ id: documentShareUser.id });

      if (updated.length === 0) {
        return NextResponse.json({ error: 'Share not found' }, { status: 404 });
      }
    } else if (shareType === 'org') {
      const updated = await db
        .update(documentShareOrg)
        .set({ permission })
        .where(
          and(
            eq(documentShareOrg.id, validatedShareId.value),
            eq(documentShareOrg.documentId, validatedDocumentId.value),
          ),
        )
        .returning({ id: documentShareOrg.id });

      if (updated.length === 0) {
        return NextResponse.json({ error: 'Share not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json(
        { error: 'shareType must be user or org' },
        { status: 400 },
      );
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
