'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/lib/toast-system';

import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';

import { login, type LoginActionState } from '../actions';
import { useSession } from 'next-auth/react';

// Function to get cookie value by name
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/chat');

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: 'idle',
    },
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    // Check for callbackUrl in search params first
    const callbackUrl = searchParams?.get('callbackUrl');
    if (callbackUrl?.startsWith('/')) {
      setRedirectPath(callbackUrl);
    } else if (typeof window !== 'undefined') {
      // Check for redirect path in cookies as fallback
      const redirectedFrom = getCookie('redirected_from');

      // If we have a redirected_from cookie, use that path
      if (redirectedFrom?.startsWith('/')) {
        setRedirectPath(redirectedFrom);

        // Clear the cookie by setting it to expire immediately
        document.cookie =
          'redirected_from=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      }

      // Check for signout redirect
      const signoutRedirect = sessionStorage.getItem('signout-redirect');
      if (signoutRedirect === 'true') {
        // Clear the signout flag
        sessionStorage.removeItem('signout-redirect');
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (state.status === 'failed') {
      toast.error('Invalid credentials!');
    } else if (state.status === 'invalid_data') {
      toast.error('Failed validating your submission!');
    } else if (state.status === 'success') {
      setIsSuccessful(true);
      updateSession();

      // Redirect to the appropriate path after successful login
      window.location.href = redirectPath;
    }
  }, [state.status, redirectPath, router, updateSession]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Sign In</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Use your email and password to sign in
          </p>
        </div>
        <AuthForm
          action={handleSubmit}
          defaultEmail={email}
          callbackUrl={redirectPath}
        >
          <SubmitButton isSuccessful={isSuccessful}>Sign in</SubmitButton>
          <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
            {"Don't have an account? "}
            <Link
              href="/register"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              Sign up
            </Link>
            {' for free.'}
          </p>
        </AuthForm>
      </div>
    </div>
  );
}
