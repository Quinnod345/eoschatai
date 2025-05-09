import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Helper function to clear auth-related cookies
async function clearAuthCookies() {
  // In newer Next.js versions, cookies() returns a Promise
  const cookieStore = await cookies();

  // Clear specific auth-related cookies directly
  const authCookieNames = [
    'next-auth.session-token',
    'next-auth.csrf-token',
    'next-auth.callback-url',
    'authjs.session-token',
    'authjs.csrf-token',
    'authjs.callback-url',
    'auth.session-token',
    'auth.csrf-token',
    'auth.callback-url',
  ];

  for (const name of authCookieNames) {
    try {
      await cookieStore.delete(name);
      await cookieStore.delete({ name, path: '/' });
    } catch (error) {
      // Ignore errors if cookie doesn't exist
      console.error(`Error clearing cookie ${name}:`, error);
    }
  }

  // Iterate through cookies safely
  try {
    const cookies = cookieStore.getAll();
    for (const cookie of cookies) {
      const name = cookie.name;
      if (
        name.includes('auth') ||
        name.includes('session') ||
        name.startsWith('next-auth')
      ) {
        try {
          await cookieStore.delete(name);
          await cookieStore.delete({ name, path: '/' });
        } catch (error) {
          // Ignore errors if cookie doesn't exist
          console.error(`Error clearing cookie ${name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error iterating through cookies:', error);
  }
}

export async function GET() {
  await clearAuthCookies();

  // Use 303 status to force a new GET request instead of potentially continuing a redirect chain
  return NextResponse.redirect(
    new URL(
      '/login',
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ),
    { status: 303 },
  );
}

export async function POST() {
  await clearAuthCookies();

  // Return success response for API calls
  return NextResponse.json({ success: true, redirectTo: '/login' });
}
