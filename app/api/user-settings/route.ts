import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserSettings, updateUserSettings } from '@/lib/db/queries';
import { API_CACHE } from '@/lib/api/cache-headers';
import { ApiErrors, logApiError } from '@/lib/api/error-response';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const settings = await getUserSettings({ userId: session.user.id });
    // Use private-short cache: 10s max-age with 30s stale-while-revalidate
    // Settings may change when user updates preferences
    return NextResponse.json(settings, { headers: API_CACHE.privateShort() });
  } catch (error) {
    logApiError('api/user-settings GET', error);
    return ApiErrors.internalError('Failed to get user settings');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.invalidJson();
    }

    console.log(
      '[POST /api/user-settings] Received body:',
      JSON.stringify(body, null, 2),
    );
    console.log('[POST /api/user-settings] User ID:', session.user.id);

    const settings = await updateUserSettings({
      userId: session.user.id,
      settings: body,
    });

    console.log('[POST /api/user-settings] Updated settings:', settings);

    return NextResponse.json(settings);
  } catch (error) {
    logApiError('api/user-settings POST', error);
    return ApiErrors.internalError('Failed to update user settings');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.invalidJson();
    }

    const settings = await updateUserSettings({
      userId: session.user.id,
      settings: body,
    });

    return NextResponse.json(settings);
  } catch (error) {
    logApiError('api/user-settings PATCH', error);
    return ApiErrors.internalError('Failed to update user settings');
  }
}
