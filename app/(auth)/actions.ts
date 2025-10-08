'use server';

import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';

import { createUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { user, passwordResetToken } from '@/lib/db/schema';
import { generateHashedPassword } from '@/lib/db/utils';
import { getResendClient, getFromAddress } from '@/lib/email/resend';
import PasswordResetEmail from '@/emails/PasswordResetEmail';

import { signIn } from './auth';
import { buildAppUrl } from '@/lib/utils/app-url';

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    // Get the callback URL from form data, default to '/chat'
    const callbackUrl = formData.get('callbackUrl')?.toString() || '/chat';

    console.log(`Login attempt for user: ${validatedData.email}`);

    try {
      await signIn('credentials', {
        email: validatedData.email,
        password: validatedData.password,
        redirect: false, // Change to false to handle redirect manually
      });

      return { status: 'success' };
    } catch (signInError) {
      console.error('Login error:', signInError);
      // Check if it's a redirect error (which means login was successful)
      if (
        signInError &&
        typeof signInError === 'object' &&
        'digest' in signInError
      ) {
        const digest = (signInError as any).digest;
        if (digest?.includes('NEXT_REDIRECT')) {
          // This is actually a successful login with a redirect
          return { status: 'success' };
        }
      }
      return { status: 'failed' };
    }
  } catch (error) {
    console.error('Login validation error:', error);
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data';
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    // Get the callback URL from form data, default to '/chat'
    const callbackUrl = formData.get('callbackUrl')?.toString() || '/chat';

    // Check if the user already exists
    const users = await getUser(validatedData.email);

    if (users.length > 0) {
      console.log(
        `Registration attempt: User with email ${validatedData.email} already exists`,
      );
      return { status: 'user_exists' };
    }

    // Create the new user
    console.log(
      `Registration: Creating new user with email ${validatedData.email}`,
    );
    await createUser(validatedData.email, validatedData.password);

    // Attempt to sign in with the new credentials
    try {
      await signIn('credentials', {
        email: validatedData.email,
        password: validatedData.password,
        redirect: false, // Change to false to handle redirect manually
      });

      return { status: 'success' };
    } catch (signInError) {
      console.error('Error signing in after registration:', signInError);
      // Check if it's a redirect error (which means login was successful)
      if (
        signInError &&
        typeof signInError === 'object' &&
        'digest' in signInError
      ) {
        const digest = (signInError as any).digest;
        if (digest?.includes('NEXT_REDIRECT')) {
          // This is actually a successful login with a redirect
          return { status: 'success' };
        }
      }
      // Even if sign-in fails, registration was successful
      return { status: 'success' };
    }
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

// Password Reset Actions
export interface ForgotPasswordActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'invalid_email'
    | 'user_not_found';
}

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const forgotPassword = async (
  _: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> => {
  try {
    const validatedData = forgotPasswordSchema.parse({
      email: formData.get('email'),
    });

    console.log(`Password reset request for: ${validatedData.email}`);

    // Check if user exists
    const users = await getUser(validatedData.email);
    if (users.length === 0) {
      console.log(`Password reset: User ${validatedData.email} not found`);
      // Return success to prevent user enumeration
      return { status: 'success' };
    }

    const [existingUser] = users;

    // Check if user has a password (not OAuth only)
    if (!existingUser.password) {
      console.log(`Password reset: User ${validatedData.email} is OAuth only`);
      // Still send an email explaining they use OAuth
      // For now, just return success
      return { status: 'success' };
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Delete any existing tokens for this user
    await db
      .delete(passwordResetToken)
      .where(eq(passwordResetToken.userId, existingUser.id));

    // Create new token
    await db.insert(passwordResetToken).values({
      userId: existingUser.id,
      token,
      expiresAt,
    });

    // Build reset link
    const resetLink = buildAppUrl('/reset-password', { token });

    // Send email via Resend
    const resend = getResendClient();
    if (!resend) {
      console.error('[forgot-password] Resend client not configured');
      return { status: 'failed' };
    }

    const from = getFromAddress();
    const { data, error } = await resend.emails.send({
      from,
      to: validatedData.email,
      subject: 'Reset your password - EOS AI',
      react: PasswordResetEmail({
        toEmail: validatedData.email,
        resetLink,
      }),
    });

    if (error) {
      console.error('[forgot-password] Resend error', error);
      return { status: 'failed' };
    }

    console.log(
      `Password reset email sent to ${validatedData.email} (${data?.id})`,
    );
    return { status: 'success' };
  } catch (error) {
    console.error('Forgot password error:', error);
    if (error instanceof z.ZodError) {
      return { status: 'invalid_email' };
    }
    return { status: 'failed' };
  }
};

export interface ResetPasswordActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'invalid_token'
    | 'expired_token'
    | 'invalid_data';
}

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
  confirmPassword: z.string(),
});

export const resetPassword = async (
  _: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> => {
  try {
    const validatedData = resetPasswordSchema.parse({
      token: formData.get('token'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    // Check passwords match
    if (validatedData.password !== validatedData.confirmPassword) {
      return { status: 'invalid_data' };
    }

    // Find valid token
    const tokens = await db
      .select()
      .from(passwordResetToken)
      .where(
        and(
          eq(passwordResetToken.token, validatedData.token),
          gt(passwordResetToken.expiresAt, new Date()),
          isNull(passwordResetToken.usedAt),
        ),
      );

    if (tokens.length === 0) {
      // Check why token is invalid
      const allTokens = await db
        .select()
        .from(passwordResetToken)
        .where(eq(passwordResetToken.token, validatedData.token));

      if (allTokens.length > 0) {
        const token = allTokens[0];
        if (token.usedAt) {
          console.log('Password reset: Token has already been used');
          return { status: 'expired_token' };
        } else if (token.expiresAt <= new Date()) {
          console.log('Password reset: Token has expired');
          return { status: 'expired_token' };
        }
      } else {
        console.log('Password reset: Invalid token');
      }

      return { status: 'invalid_token' };
    }

    const [resetToken] = tokens;

    // Hash the new password
    const hashedPassword = generateHashedPassword(validatedData.password);

    // Update user password
    await db
      .update(user)
      .set({ password: hashedPassword })
      .where(eq(user.id, resetToken.userId));

    // Mark token as used
    await db
      .update(passwordResetToken)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetToken.id, resetToken.id));

    console.log(`Password reset successful for user ${resetToken.userId}`);
    return { status: 'success' };
  } catch (error) {
    console.error('Reset password error:', error);
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }
    return { status: 'failed' };
  }
};
