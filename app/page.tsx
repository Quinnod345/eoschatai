import { redirect } from 'next/navigation';
import { auth } from './(auth)/auth';

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    // If user is authenticated, redirect to chat
    redirect('/chat');
  } else {
    // If user is not authenticated, redirect to login
    redirect('/login');
  }
}
