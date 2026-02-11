import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserSettings, updateUserSettings } from '@/lib/db/queries';
import { API_CACHE } from '@/lib/api/cache-headers';

const normalizeSettingsPayload = (
  payload: unknown,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string } => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Invalid settings payload' };
  }

  const normalized = {
    ...(payload as Record<string, unknown>),
  };

  if (normalized.timezone !== undefined) {
    if (typeof normalized.timezone !== 'string') {
      return { ok: false, error: 'timezone must be a string' };
    }

    const timezone = normalized.timezone.trim();
    if (timezone.length > 64) {
      return { ok: false, error: 'timezone must be 64 characters or less' };
    }

    normalized.timezone = timezone || 'UTC';
  }

  return { ok: true, value: normalized };
};

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getUserSettings({ userId: session.user.id });
    // Use private-short cache: 10s max-age with 30s stale-while-revalidate
    // Settings may change when user updates preferences
    return NextResponse.json(settings, { headers: API_CACHE.privateShort() });
  } catch (error) {
    console.error('Error getting user settings:', error);
    return NextResponse.json(
      { error: 'Failed to get user settings' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const payload = normalizeSettingsPayload(rawBody);
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    console.log(
      '[POST /api/user-settings] Received body:',
      JSON.stringify(payload.value, null, 2),
    );
    console.log('[POST /api/user-settings] User ID:', session.user.id);

    const settings = await updateUserSettings({
      userId: session.user.id,
      settings: payload.value,
    });

    console.log('[POST /api/user-settings] Updated settings:', settings);

    return NextResponse.json(settings);
  } catch (error) {
    console.error(
      '[POST /api/user-settings] Error updating user settings:',
      error,
    );
    return NextResponse.json(
      {
        error: 'Failed to update user settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const payload = normalizeSettingsPayload(rawBody);
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const settings = await updateUserSettings({
      userId: session.user.id,
      settings: payload.value,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json(
      { error: 'Failed to update user settings' },
      { status: 500 },
    );
  }
}
