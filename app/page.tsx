import { headers } from 'next/headers';
import MarketingHome from '@/components/marketing/marketing-home';
import { auth } from './(auth)/auth';
import ClientRedirect from '@/components/client-redirect';

function isAppHostname(hostname: string) {
  const configuredHosts = (process.env.APP_HOSTNAMES ?? 'app.eosbot.ai')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configuredHosts.some((configuredHost) => {
    if (hostname === configuredHost) {
      return true;
    }

    return hostname.endsWith(`.${configuredHost}`);
  });
}

export default async function Home() {
  const hostHeader = headers().get('host')?.toLowerCase() ?? '';
  const hostname = hostHeader.split(':')[0];

  if (!hostname || !isAppHostname(hostname)) {
    return <MarketingHome />;
  }

  const session = await auth();

  if (session?.user) {
    // If user is authenticated, redirect to chat (client-side)
    return <ClientRedirect path="/chat" />;
  }

  // If user is not authenticated, redirect to login (client-side)
  return <ClientRedirect path="/login" />;
}
