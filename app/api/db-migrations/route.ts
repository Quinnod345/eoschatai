import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST(_request: NextRequest) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

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
