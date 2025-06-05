// This page has both client and server components
// The main Home component is a Server Component
// The ChatAnimation is a Client Component

// Mark the client component separately
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import { auth } from './(auth)/auth';

// Import GSAP in a separate client component file
import ChatAnimationContainer from '../components/ChatAnimationContainer';
import HomeClient from './HomeClient';

export default async function Home() {
  const session = await auth();

  // If user is already logged in, redirect to chat
  if (session) {
    redirect('/chat');
  }

  return <HomeClient />;
}
