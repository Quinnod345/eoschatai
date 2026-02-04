import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - EOS AI',
  description: 'Sign in to your EOS AI account and access your AI-powered assistant for EOS implementation. Get instant help with V/TO creation, Level 10 meetings, and business growth.',
  keywords: [
    'EOS AI login', 'sign in', 'EOS AI account', 'AI assistant login',
    'business AI access', 'EOS tools login', 'AI chatbot signin'
  ],
  openGraph: {
    title: 'Sign In - EOS AI',
    description: 'Sign in to your EOS AI account and access your AI-powered assistant for EOS implementation.',
    url: 'https://eosbot.ai/login',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Sign In - EOS AI',
    description: 'Sign in to your EOS AI account and access your AI-powered assistant for EOS implementation.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://eosbot.ai/login',
  },
};

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState, Suspense } from 'react';
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/chat');
  const [mounted, setMounted] = useState(false);

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
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 100); // Small delay to ensure session is updated
    }
  }, [state.status, redirectPath, router, updateSession]);

  // Trigger entrance transition after hydration
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  return (
    <div className="relative flex h-dvh w-screen items-center justify-center bg-background overflow-hidden">
      {/* EOS chat window gradient mesh background */}
      <div
        className="absolute inset-0 pointer-events-none filter blur-[80px] opacity-100"
        style={{
          background: `
            radial-gradient(circle 300px at 15% 20%, rgba(255,118,0,0.25), transparent),
            radial-gradient(circle 350px at 85% 15%, rgba(14,165,233,0.22), transparent),
            radial-gradient(circle 280px at 10% 70%, rgba(0,46,93,0.20), transparent),
            radial-gradient(circle 320px at 90% 80%, rgba(255,118,0,0.18), transparent),
            radial-gradient(circle 250px at 50% 50%, rgba(14,165,233,0.15), transparent),
            radial-gradient(circle 300px at 35% 85%, rgba(0,46,93,0.18), transparent),
            radial-gradient(circle 280px at 65% 30%, rgba(255,118,0,0.20), transparent)
          `,
        }}
      />

      <div
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-10 p-6 sm:p-8 eos-glass shadow-modern-dark transform transition-all duration-700 ease-out-expo will-change-[transform,opacity,filter] hover:translate-y-[-2px] hover:shadow-[0_20px_40px_-5px_rgba(0,46,93,0.25)] ${mounted ? 'opacity-100 translate-y-0 scale-100 blur-0' : 'opacity-0 translate-y-[6px] scale-[0.988] blur-[2px]'}`}
      >
        <div
          className="flex flex-col items-center justify-center gap-2 px-2 text-center sm:px-4 opacity-0 animate-blur-in-text"
          style={{ animationDelay: '80ms' }}
        >
          <h3 className="text-2xl font-semibold dark:text-zinc-50" style={{}}>
            Sign In
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400" style={{}} />
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute -inset-12 opacity-40 blur-2xl eos-rotating-gradient" />
          <AuthForm
            action={handleSubmit}
            defaultEmail={email}
            callbackUrl={redirectPath}
          >
            <div className="flex flex-col gap-3">
              <SubmitButton isSuccessful={isSuccessful}>Sign in</SubmitButton>
              <Link
                href="/forgot-password"
                className="text-center text-sm text-gray-600 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
              >
                Forgot your password?
              </Link>
            </div>
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
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-screen items-center justify-center bg-background">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
