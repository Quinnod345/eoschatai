import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { apiKey } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// DELETE /api/api-keys/[id] - Revoke an API key
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    // Check that the key belongs to the user and is not already revoked
    const [existingKey] = await db
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(
        and(
          eq(apiKey.id, id),
          eq(apiKey.userId, session.user.id),
          isNull(apiKey.revokedAt)
        )
      );

    if (!existingKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Revoke the key by setting revokedAt
    await db
      .update(apiKey)
      .set({ revokedAt: new Date() })
      .where(eq(apiKey.id, id));

    return NextResponse.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

// PATCH /api/api-keys/[id] - Update API key name
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Key name is required' },
        { status: 400 }
      );
    }

    // Check that the key belongs to the user and is not revoked
    const [existingKey] = await db
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(
        and(
          eq(apiKey.id, id),
          eq(apiKey.userId, session.user.id),
          isNull(apiKey.revokedAt)
        )
      );

    if (!existingKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Update the name
    const [updatedKey] = await db
      .update(apiKey)
      .set({ name: name.trim() })
      .where(eq(apiKey.id, id))
      .returning({ name: apiKey.name });

    return NextResponse.json({ success: true, name: updatedKey.name });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}
