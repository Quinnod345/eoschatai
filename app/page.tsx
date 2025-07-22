import { auth } from './(auth)/auth';
import ClientRedirect from '@/components/client-redirect';

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    // If user is authenticated, redirect to chat (client-side)
    return <ClientRedirect path="/chat" />;
  } else {
    // If user is not authenticated, redirect to login (client-side)
    return <ClientRedirect path="/login" />;
  }
}
