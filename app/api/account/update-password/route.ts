import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { compare } from 'bcrypt-ts';
import { generateHashedPassword } from '@/lib/db/utils';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Don't allow guest users to change their password
  if (session.user.type === 'guest' || session.user.email?.includes('guest-')) {
    return NextResponse.json(
      { error: 'Guest accounts cannot change their password' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 },
      );
    }

    // Validate new password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    // Get the user from the database
    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id));

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [userData] = users;

    // Verify current password
    if (!userData.password) {
      return NextResponse.json(
        { error: 'Your account does not have a password set' },
        { status: 400 },
      );
    }

    const passwordMatches = await compare(currentPassword, userData.password);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 },
      );
    }

    // Update the password
    const hashedPassword = generateHashedPassword(newPassword);
    await db
      .update(user)
      .set({ password: hashedPassword })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 },
    );
  }
}
