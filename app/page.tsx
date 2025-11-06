import { redirect } from 'next/navigation';
import { auth } from './(auth)/auth';
import LandingPageClient from './landing-page-client';
import { guestRegex } from '@/lib/constants';

export default async function HomePage() {
  // Check if user is authenticated
  const session = await auth();

  // If user is logged in and not a guest, redirect to chat
  if (session?.user) {
    const isGuest = guestRegex.test(session.user.email ?? '');
    if (!isGuest) {
      redirect('/chat');
    }
  }

  // Otherwise, show the landing page
  return <LandingPageClient />;
}

