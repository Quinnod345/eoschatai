'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  useActionState,
  useEffect,
  useState,
  Suspense,
  useTransition,
} from 'react';
import Link from 'next/link';

import { SubmitButton } from '@/components/submit-button';
import { resetPassword, type ResetPasswordActionState } from '../actions';
import { toast } from '@/lib/toast-system';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/password-strength';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';

  const [isSuccessful, setIsSuccessful] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [state, formAction] = useActionState<
    ResetPasswordActionState,
    FormData
  >(resetPassword, {
    status: 'idle',
  });

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link');
      router.push('/forgot-password');
    }
  }, [token, router]);

  useEffect(() => {
    if (state.status === 'invalid_token') {
      toast.error('Invalid or expired reset link');
    } else if (state.status === 'expired_token') {
      toast.error('This reset link has expired');
    } else if (state.status === 'invalid_data') {
      toast.error('Please ensure your passwords match');
    } else if (state.status === 'failed') {
      toast.error('Failed to reset password. Please try again.');
    } else if (state.status === 'success') {
      setIsSuccessful(true);
      toast.success('Password reset successfully!');

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    }
  }, [state.status, router]);

  // Trigger entrance transition after hydration
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = (formData: FormData) => {
    // Add token to form data
    formData.append('token', token);
    startTransition(() => {
      formAction(formData);
    });
  };

  if (!token) {
    return null;
  }

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
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-10 p-6 sm:p-8 eos-glass shadow-modern-dark transform transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity,filter] hover:translate-y-[-2px] hover:shadow-[0_20px_40px_-5px_rgba(0,46,93,0.25)] ${mounted ? 'opacity-100 translate-y-0 scale-100 blur-0' : 'opacity-0 translate-y-[6px] scale-[0.988] blur-[2px]'}`}
      >
        <div
          className="flex flex-col items-center justify-center gap-2 px-2 text-center sm:px-4 opacity-0 animate-blur-in-text"
          style={{ animationDelay: '80ms' }}
        >
          <h3 className="text-2xl font-semibold dark:text-zinc-50">
            Create new password
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Enter your new password below
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
                  htmlFor="password"
                  className="text-zinc-600 font-normal dark:text-zinc-400"
                >
                  New Password
                </Label>

                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    className="bg-muted text-md md:text-sm pr-10"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <PasswordStrength password={password} className="mt-2" />
              </div>

              <div
                className="flex flex-col gap-2 opacity-0 animate-blur-in-char"
                style={{ animationDelay: '460ms' }}
              >
                <Label
                  htmlFor="confirmPassword"
                  className="text-zinc-600 font-normal dark:text-zinc-400"
                >
                  Confirm New Password
                </Label>

                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    className={cn('bg-muted text-md md:text-sm pr-10', {
                      'border-red-500 focus:border-red-500':
                        confirmPassword && confirmPassword !== password,
                    })}
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-sm text-red-500 mt-1">
                    Passwords do not match
                  </p>
                )}
              </div>

              <div
                className="opacity-0 animate-blur-in-char"
                style={{ animationDelay: '560ms' }}
              >
                <SubmitButton isSuccessful={isSuccessful || isPending}>
                  Reset password
                </SubmitButton>
              </div>

              <p
                className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400 opacity-0 animate-blur-in-char"
                style={{ animationDelay: '660ms' }}
              >
                Remember your password?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                >
                  Sign in
                </Link>
              </p>
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
                  Password reset successfully!
                </h4>

                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Your password has been updated. Redirecting to login...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}


