import { signIn } from 'next-auth/react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

export function GoogleSignInButton({
  callbackUrl = '/chat',
}: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full flex items-center justify-center gap-2 py-5"
      onClick={() => signIn('google', { callbackUrl })}
      aria-label="Sign in with Google"
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

export function AuthForm({
  action,
  children,
  defaultEmail = '',
  showSocial = true,
  callbackUrl = '/chat',
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  showSocial?: boolean;
  callbackUrl?: string;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (typeof action === 'function') {
      const formData = new FormData(e.currentTarget);
      action(formData);
    }
  };

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
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-muted-foreground bg-background">
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
          className="text-muted-foreground font-normal"
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
          defaultValue={defaultEmail}
        />
      </div>

      <div
        className="flex flex-col gap-2 opacity-0 animate-blur-in-char"
        style={{ animationDelay: '640ms' }}
      >
        <Label
          htmlFor="password"
          className="text-muted-foreground font-normal"
        >
          Password
        </Label>

        <Input
          id="password"
          name="password"
          className="bg-muted text-md md:text-sm"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby="password-requirements"
        />
        <span id="password-requirements" className="sr-only">
          Password must be at least 6 characters
        </span>
      </div>

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div
        className="opacity-0 animate-blur-in-char"
        style={{ animationDelay: '720ms' }}
      >
        {children}
      </div>
    </form>
  );
}
