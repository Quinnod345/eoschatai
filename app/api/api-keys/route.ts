import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { apiKey } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateApiKey } from '@/lib/api-keys/utils';
import { getUserEntitlements } from '@/lib/entitlements';
import { ApiErrors, logApiError } from '@/lib/api/error-response';

// GET /api/api-keys - List all API keys for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check if user has API access
    const entitlements = await getUserEntitlements(session.user.id);
    if (!entitlements.features.api_access) {
      return ApiErrors.planRequired('API access', 'Business');
    }

    // Fetch all active keys for the user
    const keys = await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        usageCount: apiKey.usageCount,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      })
      .from(apiKey)
      .where(
        and(
          eq(apiKey.userId, session.user.id),
          eq(apiKey.isActive, true)
        )
      )
      .orderBy(desc(apiKey.createdAt));

    return NextResponse.json({ keys });
  } catch (error) {
    logApiError('api/api-keys GET', error);
    return ApiErrors.internalError('Failed to fetch API keys');
  }
}

// POST /api/api-keys - Create a new API key
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check if user has API access
    const entitlements = await getUserEntitlements(session.user.id);
    if (!entitlements.features.api_access) {
      return ApiErrors.planRequired('API access', 'Business');
    }

    let body: { name?: string; expiresAt?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.invalidJson();
    }

    const { name, expiresAt } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return ApiErrors.missingField('name');
    }

    if (name.length > 100) {
      return ApiErrors.invalidField('name', 'Key name must be 100 characters or less');
    }

    // Check existing key count (limit to 10 active keys per user)
    const existingKeys = await db
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(
        and(
          eq(apiKey.userId, session.user.id),
          eq(apiKey.isActive, true)
        )
      );

    if (existingKeys.length >= 10) {
      return ApiErrors.validationFailed('Maximum of 10 active API keys allowed');
    }

    // Generate new API key
    const { fullKey, keyHash, keyPrefix } = generateApiKey();

    // Insert into database
    const [newKey] = await db
      .insert(apiKey)
      .values({
        userId: session.user.id,
        name: name.trim(),
        keyHash,
        keyPrefix,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      });

    // Return the full key ONLY on creation (user must save it)
    return NextResponse.json({
      key: {
        ...newKey,
        fullKey, // Only returned on creation!
      },
      message: 'API key created. Save this key now - it will not be shown again.',
    });
  } catch (error) {
    logApiError('api/api-keys POST', error);
    return ApiErrors.internalError('Failed to create API key');
  }
}
