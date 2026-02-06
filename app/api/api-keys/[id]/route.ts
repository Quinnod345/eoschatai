import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { apiKey } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ApiErrors, logApiError } from '@/lib/api/error-response';

// DELETE /api/api-keys/[id] - Revoke an API key
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;

    if (!id) {
      return ApiErrors.missingField('id');
    }

    // Check that the key belongs to the user and is not already revoked
    const [existingKey] = await db
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(
        and(
          eq(apiKey.id, id),
          eq(apiKey.userId, session.user.id),
          eq(apiKey.isActive, true)
        )
      );

    if (!existingKey) {
      return ApiErrors.notFound('API key');
    }

    // Deactivate the key
    await db
      .update(apiKey)
      .set({ isActive: false })
      .where(eq(apiKey.id, id));

    return NextResponse.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    logApiError('api/api-keys/[id] DELETE', error);
    return ApiErrors.internalError('Failed to revoke API key');
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
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    
    let body: { name?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.invalidJson();
    }
    
    const { name } = body;

    if (!id) {
      return ApiErrors.missingField('id');
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return ApiErrors.missingField('name');
    }

    // Check that the key belongs to the user and is not revoked
    const [existingKey] = await db
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(
        and(
          eq(apiKey.id, id),
          eq(apiKey.userId, session.user.id),
          eq(apiKey.isActive, true)
        )
      );

    if (!existingKey) {
      return ApiErrors.notFound('API key');
    }

    // Update the name
    const [updatedKey] = await db
      .update(apiKey)
      .set({ name: name.trim() })
      .where(eq(apiKey.id, id))
      .returning({ name: apiKey.name });

    return NextResponse.json({ success: true, name: updatedKey.name });
  } catch (error) {
    logApiError('api/api-keys/[id] PATCH', error);
    return ApiErrors.internalError('Failed to update API key');
  }
}
