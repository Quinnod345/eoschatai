import { auth } from './(auth)/auth';
import HomeClient from './HomeClient';
import ClientRedirect from '@/components/client-redirect';

export default async function Home() {
  const session = await auth();

  // If user is already logged in, redirect to chat using client-side redirect
  if (session) {
    return <ClientRedirect path="/chat" />;
  }

  return <HomeClient />;
}
