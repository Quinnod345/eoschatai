'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { PasswordStrength } from './password-strength';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GoogleSignInButton({
  callbackUrl = '/chat',
}: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full flex items-center justify-center gap-2 py-5"
      onClick={() => signIn('google', { callbackUrl })}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 48 48"
      >
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
      <span>Sign in with Google</span>
    </Button>
  );
}

interface AuthFormEnhancedProps {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  showSocial?: boolean;
  callbackUrl?: string;
  mode?: 'login' | 'register';
  onValidationError?: (errors: Record<string, string>) => void;
}

export function AuthFormEnhanced({
  action,
  children,
  defaultEmail = '',
  showSocial = true,
  callbackUrl = '/chat',
  mode = 'login',
  onValidationError,
}: AuthFormEnhancedProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateEmail = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email is required';
    if (!emailRegex.test(email)) return 'Please enter a valid email';
    return '';
  }, []);

  const validatePassword = useCallback(
    (password: string) => {
      if (!password) return 'Password is required';
      if (mode === 'register' && password.length < 8) {
        return 'Password must be at least 8 characters';
      }
      return '';
    },
    [mode],
  );

  const validateConfirmPassword = useCallback(
    (confirmPass: string) => {
      if (mode !== 'register') return '';
      if (!confirmPass) return 'Please confirm your password';
      if (confirmPass !== password) return 'Passwords do not match';
      return '';
    },
    [mode, password],
  );

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;

    if (mode === 'register') {
      const confirmError = validateConfirmPassword(confirmPassword);
      if (confirmError) newErrors.confirmPassword = confirmError;

      if (!agreedToTerms) newErrors.terms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    email,
    password,
    confirmPassword,
    agreedToTerms,
    mode,
    validateEmail,
    validatePassword,
    validateConfirmPassword,
  ]);

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      switch (field) {
        case 'email': {
          const emailError = validateEmail(email);
          setErrors((prev) => ({ ...prev, email: emailError }));
          break;
        }
        case 'password': {
          const passwordError = validatePassword(password);
          setErrors((prev) => ({ ...prev, password: passwordError }));
          break;
        }
        case 'confirmPassword': {
          const confirmError = validateConfirmPassword(confirmPassword);
          setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
          break;
        }
      }
    },
    [
      email,
      password,
      confirmPassword,
      validateEmail,
      validatePassword,
      validateConfirmPassword,
    ],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = { email: true, password: true };
    if (mode === 'register') {
      allTouched.confirmPassword = true;
      allTouched.terms = true;
    }
    setTouched(allTouched);

    if (!validateForm()) {
      onValidationError?.(errors);
      return;
    }

    if (typeof action === 'function') {
      const formData = new FormData(e.currentTarget);
      action(formData);
    }
  };

  useEffect(() => {
    if (touched.confirmPassword && mode === 'register') {
      const confirmError = validateConfirmPassword(confirmPassword);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
    }
  }, [
    password,
    confirmPassword,
    touched.confirmPassword,
    mode,
    validateConfirmPassword,
  ]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 px-4 sm:px-16"
      action={typeof action === 'string' ? action : undefined}
    >
      {showSocial && (
        <>
          <div
            className="opacity-0 animate-blur-in-char"
            style={{ animationDelay: '360ms' }}
          >
            <GoogleSignInButton callbackUrl={callbackUrl} />
          </div>
          <div
            className="relative my-2 opacity-0 animate-blur-in-text"
            style={{ animationDelay: '460ms' }}
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-gray-500 bg-background dark:text-zinc-400">
                or continue with email
              </span>
            </div>
          </div>
        </>
      )}

      <div
        className="flex flex-col gap-2 opacity-0 animate-blur-in-char"
        style={{ animationDelay: '560ms' }}
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
          className={cn('bg-muted text-md md:text-sm', {
            'border-red-500 focus:border-red-500':
              touched.email && errors.email,
          })}
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur('email')}
        />
        {touched.email && errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email}</p>
        )}
      </div>

      <div
        className="flex flex-col gap-2 opacity-0 animate-blur-in-char"
        style={{ animationDelay: '640ms' }}
      >
        <Label
          htmlFor="password"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Password
        </Label>

        <div className="relative">
          <Input
            id="password"
            name="password"
            className={cn('bg-muted text-md md:text-sm pr-10', {
              'border-red-500 focus:border-red-500':
                touched.password && errors.password,
            })}
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {touched.password && errors.password && (
          <p className="text-sm text-red-500 mt-1">{errors.password}</p>
        )}

        {mode === 'register' && (
          <PasswordStrength password={password} className="mt-2" />
        )}
      </div>

      {mode === 'register' && (
        <>
          <div
            className="flex flex-col gap-2 opacity-0 animate-blur-in-char"
            style={{ animationDelay: '720ms' }}
          >
            <Label
              htmlFor="confirmPassword"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Confirm Password
            </Label>

            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                className={cn('bg-muted text-md md:text-sm pr-10', {
                  'border-red-500 focus:border-red-500':
                    touched.confirmPassword && errors.confirmPassword,
                })}
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <p className="text-sm text-red-500 mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <div
            className="flex items-start gap-2 opacity-0 animate-blur-in-char"
            style={{ animationDelay: '800ms' }}
          >
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) =>
                setAgreedToTerms(checked as boolean)
              }
              className="mt-1"
            />
            <Label
              htmlFor="terms"
              className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer"
            >
              I agree to the{' '}
              <a
                href="/terms"
                className="underline hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="/privacy"
                className="underline hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Privacy Policy
              </a>
            </Label>
          </div>
          {touched.terms && errors.terms && (
            <p className="text-sm text-red-500 -mt-2">{errors.terms}</p>
          )}
        </>
      )}

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div
        className="opacity-0 animate-blur-in-char"
        style={{ animationDelay: mode === 'register' ? '880ms' : '720ms' }}
      >
        {children}
      </div>
    </form>
  );
}
