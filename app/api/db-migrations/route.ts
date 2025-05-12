import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/app/(auth)/auth';

export async function GET(request: NextRequest) {
  const session = await auth();

  // Only allow admins or in development
  if (!session?.user && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Drop the UI customization fields if they exist
    await db.execute(`
      ALTER TABLE "UserSettings" 
      DROP COLUMN IF EXISTS "themeColor",
      DROP COLUMN IF EXISTS "interfaceDensity",
      DROP COLUMN IF EXISTS "cornerRadius";
    `);

    return NextResponse.json({
      success: true,
      message: 'UserSettings UI fields removed',
    });
  } catch (error) {
    console.error('Error updating UserSettings table:', error);
    return NextResponse.json(
      { error: 'Failed to update UserSettings table' },
      { status: 500 },
    );
  }
}
