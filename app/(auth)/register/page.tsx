import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up Free - Start Your AI-Powered EOS Journey | EOS AI',
  description: 'Create your free EOS AI account and transform your business implementation. Get instant access to AI-powered V/TO creation, Level 10 meeting assistance, and advanced business tools.',
  keywords: [
    'EOS AI signup', 'free EOS AI account', 'AI assistant registration', 'EOS AI trial',
    'business AI sign up', 'free AI chatbot', 'EOS implementation trial',
    'AI business tools signup', 'free business AI', 'EOS AI free trial'
  ],
  openGraph: {
    title: 'Sign Up Free - Start Your AI-Powered EOS Journey | EOS AI',
    description: 'Create your free EOS AI account and transform your business implementation. Get instant access to AI-powered tools and assistance.',
    url: 'https://eosbot.ai/register',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Sign Up Free - Start Your AI-Powered EOS Journey | EOS AI',
    description: 'Create your free EOS AI account and transform your business implementation.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://eosbot.ai/register',
  },
};

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { AuthFormEnhanced } from '@/components/auth-form-enhanced';
import { SubmitButton } from '@/components/submit-button';

import { register, type RegisterActionState } from '../actions';
import { toast } from '@/lib/toast-system';
import { useSession } from 'next-auth/react';

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: 'idle',
    },
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (state.status === 'user_exists') {
      toast.error('Account already exists!');
    } else if (state.status === 'failed') {
      toast.error('Failed to create account!');
    } else if (state.status === 'invalid_data') {
      toast.error('Failed validating your submission!');
    } else if (state.status === 'success') {
      toast.success('Account created successfully!');

      setIsSuccessful(true);
      updateSession();

      // Redirect to chat after successful registration
      setTimeout(() => {
        window.location.href = '/chat';
      }, 100); // Small delay to ensure session is updated
    }
  }, [state.status, router, updateSession]);

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
            Sign Up
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400" style={{}}>
            Create an account with your email and password
          </p>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute -inset-12 opacity-40 blur-2xl eos-rotating-gradient" />
          <AuthFormEnhanced
            action={handleSubmit}
            defaultEmail={email}
            mode="register"
            onValidationError={(errors) => {
              const firstError = Object.values(errors)[0];
              if (firstError) {
                toast.error(firstError);
              }
            }}
          >
            <SubmitButton isSuccessful={isSuccessful}>
              Create account
            </SubmitButton>
            <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
              {'Already have an account? '}
              <Link
                href="/login"
                className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              >
                Sign in
              </Link>
              {' instead.'}
            </p>
          </AuthFormEnhanced>
        </div>
      </div>
    </div>
  );
}
