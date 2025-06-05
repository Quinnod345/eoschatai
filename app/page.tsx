
import { redirect } from 'next/navigation';
import { auth } from './(auth)/auth';
import HomeClient from './HomeClient';

export default async function Home() {
  const session = await auth();

  // If user is already logged in, redirect to chat
  if (session) {
    redirect('/chat');
  }

  return <HomeClient />;
}
