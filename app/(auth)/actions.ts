'use server';

import { z } from 'zod';

import { createUser, getUser } from '@/lib/db/queries';

import { signIn } from './auth';

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

    console.log(`Login attempt for user: ${validatedData.email}`);

    try {
      await signIn('credentials', {
        email: validatedData.email,
        password: validatedData.password,
        redirect: true,
        callbackUrl: '/chat',
      });

      return { status: 'success' };
    } catch (signInError) {
      console.error('Login error:', signInError);
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
        redirect: true,
        callbackUrl: '/chat',
      });

      return { status: 'success' };
    } catch (signInError) {
      console.error('Error signing in after registration:', signInError);
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
