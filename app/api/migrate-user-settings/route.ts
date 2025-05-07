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
    // Manual migration to create UserSettings table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "UserSettings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "userId" uuid NOT NULL,
        "notificationsEnabled" boolean DEFAULT true,
        "language" varchar(32) DEFAULT 'english',
        "fontSize" varchar(16) DEFAULT 'medium',
        "displayName" varchar(64),
        "companyName" varchar(128),
        "companyType" varchar(64),
        "companyDescription" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );

      DO $$ BEGIN
        ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" 
        FOREIGN KEY ("userId") REFERENCES "public"."User"("id") 
        ON DELETE no action ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    return NextResponse.json({
      success: true,
      message: 'UserSettings table created',
    });
  } catch (error) {
    console.error('Error creating UserSettings table:', error);
    return NextResponse.json(
      { error: 'Failed to create UserSettings table' },
      { status: 500 },
    );
  }
}
