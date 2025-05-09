/**
 * Client-side utility functions for authentication
 */

/**
 * Clear all auth-related cookies from the browser
 * This is a fallback for cases when the server-side logout fails
 */
export function clearAuthCookies() {
  // Get all cookies
  const cookies = document.cookie.split(';');

  // For each cookie, try to clear it
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

    // If this is an auth-related cookie, clear it
    if (
      name.includes('auth') ||
      name.includes('session') ||
      name.startsWith('next-auth')
    ) {
      // Clear the cookie with multiple domain/path combinations
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
    }
  }
}

/**
 * Helper function to perform a client-side logout
 */
export async function clientLogout() {
  try {
    // Clear client-side cookies first
    clearAuthCookies();

    // Make a single POST request to our custom signout endpoint
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    // If successful, use the redirect URL from response or fallback to login
    if (response.ok) {
      const data = await response.json();

      // Clear session storage too
      sessionStorage.clear();
      localStorage.removeItem('next-auth.session-token');
      localStorage.removeItem('next-auth.csrf-token');

      // Use a direct browser navigation to login with a cache-busting parameter
      // and go to a fresh login page with no previous state
      window.location.replace(`/login?t=${Date.now()}`);
    } else {
      // Fallback to direct navigation
      window.location.replace('/login');
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Ensure we always redirect to login, even on errors
    window.location.replace('/login');
  }
}
