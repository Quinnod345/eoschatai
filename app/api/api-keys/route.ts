import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { apiKey } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateApiKey } from '@/lib/api-keys/utils';
import { getUserEntitlements } from '@/lib/entitlements';

// GET /api/api-keys - List all API keys for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has API access
    const entitlements = await getUserEntitlements(session.user.id);
    if (!entitlements.features.api_access) {
      return NextResponse.json(
        { error: 'API access is only available on Business plan' },
        { status: 403 }
      );
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
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST /api/api-keys - Create a new API key
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has API access
    const entitlements = await getUserEntitlements(session.user.id);
    if (!entitlements.features.api_access) {
      return NextResponse.json(
        { error: 'API access is only available on Business plan' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, expiresAt } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Key name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Key name must be 100 characters or less' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Maximum of 10 active API keys allowed' },
        { status: 400 }
      );
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
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
