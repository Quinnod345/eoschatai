'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { forgotPassword, type ForgotPasswordActionState } from '../actions';
import { toast } from '@/lib/toast-system';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [state, formAction] = useActionState<
    ForgotPasswordActionState,
    FormData
  >(forgotPassword, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'invalid_email') {
      toast.error('Please enter a valid email address');
    } else if (state.status === 'failed') {
      toast.error('Failed to send reset email. Please try again.');
    } else if (state.status === 'success') {
      setIsSuccessful(true);
      toast.success('Password reset email sent!');
    }
  }, [state.status]);

  // Trigger entrance transition after hydration
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <div className="relative flex h-dvh w-screen items-center justify-center bg-background overflow-hidden">
      <style jsx>{`
        @keyframes rotating-gradient {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .eos-rotating-gradient {
          background: linear-gradient(
            90deg,
            rgba(255, 140, 0, 0.3) 0%,
            rgba(255, 140, 0, 0.1) 25%,
            rgba(255, 140, 0, 0.05) 50%,
            rgba(255, 140, 0, 0.1) 75%,
            rgba(255, 140, 0, 0.3) 100%
          );
          animation: rotating-gradient 12s linear infinite;
        }
      `}</style>

      <div
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-10 p-6 sm:p-8 eos-glass shadow-modern-dark transform transition-all duration-700 ease-out-expo will-change-[transform,opacity,filter] hover:translate-y-[-2px] hover:shadow-[0_20px_40px_-5px_rgba(0,46,93,0.25)] ${mounted ? 'opacity-100 translate-y-0 scale-100 blur-0' : 'opacity-0 translate-y-[6px] scale-[0.988] blur-[2px]'}`}
      >
        <div
          className="flex flex-col items-center justify-center gap-2 px-2 text-center sm:px-4 opacity-0 animate-blur-in-text"
          style={{ animationDelay: '80ms' }}
        >
          <h3 className="text-2xl font-semibold dark:text-zinc-50">
            Reset your password
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Enter your email and we&apos;ll send you a link to reset your password
          </p>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-12 opacity-40 blur-2xl eos-rotating-gradient" />

          {!isSuccessful ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSubmit(formData);
              }}
              className="flex flex-col gap-4 px-4 sm:px-16"
            >
              <div
                className="flex flex-col gap-2 opacity-0 animate-blur-in-char"
                style={{ animationDelay: '360ms' }}
              >
                <Label
                  htmlFor="email"
                  className="text-zinc-600 font-normal dark:text-zinc-400"
                >
                  Email Address
                </Label>

                <Input
                  id="email"
                  name="email"
                  className="bg-muted text-md md:text-sm"
                  type="email"
                  placeholder="user@acme.com"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div
                className="opacity-0 animate-blur-in-char"
                style={{ animationDelay: '460ms' }}
              >
                <SubmitButton isSuccessful={isSuccessful || isPending}>
                  Send reset email
                </SubmitButton>
              </div>

              <div
                className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-zinc-400 opacity-0 animate-blur-in-char"
                style={{ animationDelay: '560ms' }}
              >
                <Link
                  href="/login"
                  className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-zinc-200"
                >
                  <ArrowLeft size={14} />
                  Back to login
                </Link>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4 px-4 sm:px-16 text-center">
              <div
                className="opacity-0 animate-blur-in-text"
                style={{ animationDelay: '100ms' }}
              >
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h4 className="text-lg font-semibold mb-2 dark:text-zinc-50">
                  Check your email
                </h4>

                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
                  We&apos;ve sent a password reset link to{' '}
                  <span className="font-medium text-gray-800 dark:text-zinc-200">
                    {email}
                  </span>
                </p>

                <div className="bg-muted rounded-lg p-4 mb-6">
                  <p className="text-xs text-gray-600 dark:text-zinc-400">
                    Didn&apos;t receive the email? Check your spam folder or click
                    below to resend.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSuccessful(false);
                    const formData = new FormData();
                    formData.append('email', email);
                    startTransition(() => {
                      formAction(formData);
                    });
                  }}
                  className="text-sm text-primary hover:underline mb-4"
                  disabled={isPending}
                >
                  {isPending ? 'Sending...' : 'Resend email'}
                </button>

                <Link
                  href="/login"
                  className="flex items-center gap-1 justify-center text-sm text-gray-600 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  <ArrowLeft size={14} />
                  Back to login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


