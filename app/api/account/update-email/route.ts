import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { compare } from 'bcrypt-ts';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v3';

const emailUpdateSchema = z.object({
  email: z.string().email('Invalid email format'),
  currentPassword: z.string().min(1, 'Current password is required'),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Don't allow guest users to change their email
  if (session.user.type === 'guest' || session.user.email?.includes('guest-')) {
    return NextResponse.json(
      { error: 'Guest accounts cannot change their email' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    // Validate email format
    const validationResult = emailUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 },
      );
    }

    const { email, currentPassword } = validationResult.data;
    const normalizedEmail = email.trim().toLowerCase();

    const [currentUser] = await db
      .select({
        id: user.id,
        password: user.password,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, session.user.id));

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!currentUser.password) {
      return NextResponse.json(
        { error: 'Your account does not have a password set' },
        { status: 400 },
      );
    }

    const passwordMatches = await compare(currentPassword, currentUser.password);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 },
      );
    }

    // Check if email is already in use
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, normalizedEmail));

    if (existingUser && existingUser.id !== session.user.id) {
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 400 },
      );
    }

    // Update the email in database
    await db
      .update(user)
      .set({ email: normalizedEmail })
      .where(eq(user.id, session.user.id));

    // Sync email to Stripe customer
    try {
      const [userRecord] = await db
        .select({ stripeCustomerId: user.stripeCustomerId })
        .from(user)
        .where(eq(user.id, session.user.id));

      if (userRecord?.stripeCustomerId) {
        const { getStripeClient } = await import('@/lib/stripe/client');
        const stripe = getStripeClient();

        if (stripe) {
          await stripe.customers.update(userRecord.stripeCustomerId, {
            email: normalizedEmail,
          });
          console.log(
            `[update-email] Updated Stripe customer ${userRecord.stripeCustomerId} email to ${normalizedEmail}`,
          );
        }
      }
    } catch (stripeError) {
      console.error(
        '[update-email] Failed to update Stripe customer email:',
        stripeError,
      );
      // Continue - don't fail email update if Stripe fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating email:', error);
    return NextResponse.json(
      { error: 'Failed to update email' },
      { status: 500 },
    );
  }
}
