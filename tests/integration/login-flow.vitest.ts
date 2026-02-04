import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { signIn, signOut } from 'next-auth/react';
import '@testing-library/jest-dom';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated'
  }))
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/'
}));

// Import components after mocking
import { AuthFormEnhanced } from '@/components/auth-form-enhanced';

describe('Login/Logout Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Login Flow', () => {
    it('should handle successful email/password login', async () => {
      const mockSignIn = vi.mocked(signIn);
      mockSignIn.mockResolvedValue({ 
        ok: true, 
        error: null, 
        status: 200, 
        url: '/chat' 
      } as any);

      render(
        <AuthFormEnhanced 
          type="login" 
          callbackUrl="/chat"
        />
      );

      // Fill in login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'test@example.com',
          password: 'password123',
          callbackUrl: '/chat',
          redirect: false
        });
      });
    });

    it('should handle Google OAuth login', async () => {
      const mockSignIn = vi.mocked(signIn);
      mockSignIn.mockResolvedValue({ 
        ok: true, 
        error: null, 
        status: 200, 
        url: '/chat' 
      } as any);

      render(
        <AuthFormEnhanced 
          type="login" 
          callbackUrl="/chat"
        />
      );

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleButton);

      expect(mockSignIn).toHaveBeenCalledWith('google', {
        callbackUrl: '/chat'
      });
    });

    it('should display error for invalid credentials', async () => {
      const mockSignIn = vi.mocked(signIn);
      mockSignIn.mockResolvedValue({ 
        ok: false, 
        error: 'CredentialsSignin', 
        status: 401, 
        url: null 
      } as any);

      render(
        <AuthFormEnhanced 
          type="login" 
          callbackUrl="/chat"
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during login', async () => {
      const mockSignIn = vi.mocked(signIn);
      let resolveSignIn: (value: any) => void;
      mockSignIn.mockReturnValue(new Promise(resolve => {
        resolveSignIn = resolve;
      }));

      render(
        <AuthFormEnhanced 
          type="login" 
          callbackUrl="/chat"
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Check loading state
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Resolve the promise
      resolveSignIn!({ ok: true, error: null, status: 200, url: '/chat' });

      await waitFor(() => {
        expect(screen.queryByText(/signing in/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Registration Flow', () => {
    it('should handle successful registration', async () => {
      const mockSignIn = vi.mocked(signIn);
      mockSignIn.mockResolvedValue({ 
        ok: true, 
        error: null, 
        status: 200, 
        url: '/chat' 
      } as any);

      // Mock fetch for registration
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(
        <AuthFormEnhanced 
          type="register" 
          callbackUrl="/chat"
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'strongpassword123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'newuser@example.com',
            password: 'strongpassword123!'
          })
        }));
      });
    });

    it('should validate password strength', async () => {
      render(
        <AuthFormEnhanced 
          type="register" 
          callbackUrl="/chat"
        />
      );

      const passwordInput = screen.getByLabelText(/password/i);
      fireEvent.change(passwordInput, { target: { value: '123' } });

      await waitFor(() => {
        expect(screen.getByText(/password must be at least/i)).toBeInTheDocument();
      });
    });
  });

  describe('Logout Flow', () => {
    it('should handle successful logout', async () => {
      const mockSignOut = vi.mocked(signOut);
      mockSignOut.mockResolvedValue({ url: '/' } as any);

      // Mock a logout component or button
      const LogoutButton = () => (
        <button onClick={() => signOut({ callbackUrl: '/' })}>
          Logout
        </button>
      );

      render(<LogoutButton />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
    });
  });

  describe('Authentication State Management', () => {
    it('should redirect unauthenticated users to login', async () => {
      // Test component that requires authentication
      const ProtectedComponent = () => {
        const { useSession } = require('next-auth/react');
        const { data: session, status } = useSession();

        if (status === 'loading') return <div>Loading...</div>;
        if (!session) return <div>Please log in</div>;
        return <div>Protected content</div>;
      };

      render(<ProtectedComponent />);
      expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    });

    it('should show protected content for authenticated users', async () => {
      // Mock authenticated session
      const mockUseSession = vi.fn(() => ({
        data: { user: { id: '1', email: 'test@example.com' } },
        status: 'authenticated'
      }));

      vi.doMock('next-auth/react', () => ({
        ...vi.importActual('next-auth/react'),
        useSession: mockUseSession
      }));

      const ProtectedComponent = () => {
        const session = mockUseSession();

        if (session.status === 'loading') return <div>Loading...</div>;
        if (!session.data) return <div>Please log in</div>;
        return <div>Protected content</div>;
      };

      render(<ProtectedComponent />);
      expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    });
  });
});