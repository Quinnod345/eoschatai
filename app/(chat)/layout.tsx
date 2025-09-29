import { cookies } from 'next/headers';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { FeaturesProvider } from '@/components/features-provider';
import { AccountProvider } from '@/components/account-provider';
import { AccountInitializer } from '@/components/account-initializer';
import { AccountForceLoader } from '@/components/account-force-loader';
import { AccountDebug } from '@/components/account-debug';
import { auth } from '../(auth)/auth';
import Script from 'next/script';

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <AccountProvider>
        <AccountForceLoader />
        <AccountInitializer />
        <FeaturesProvider user={session?.user}>
          <SidebarProvider defaultOpen={!isCollapsed}>
            <AppSidebar user={session?.user} />
            <SidebarInset>{children}</SidebarInset>
          </SidebarProvider>
        </FeaturesProvider>
        <AccountDebug />
      </AccountProvider>
    </>
  );
}
