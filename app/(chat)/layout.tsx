import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { FeaturesProvider } from '@/components/features-provider';
import { AccountProvider } from '@/components/account-provider';
import { AccountInitializer } from '@/components/account-initializer';
import { AccountForceLoader } from '@/components/account-force-loader';
import { SkipLink } from '@/components/skip-link';
import { auth } from '../(auth)/auth';
import { getUserWithOrg } from '@/lib/db/users';
import Script from 'next/script';

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  if (session?.user?.id) {
    const record = await getUserWithOrg(session.user.id);
    if (record?.user.plan === 'business' && !record.user.orgId) {
      redirect('/setup/organization');
    }
  }

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <SkipLink />
      <AccountProvider>
        <AccountForceLoader />
        <AccountInitializer />
        <FeaturesProvider user={session?.user}>
          <SidebarProvider defaultOpen={!isCollapsed}>
            <AppSidebar user={session?.user} />
            <SidebarInset>
              <main id="main-content" tabIndex={-1} className="outline-none">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </FeaturesProvider>
      </AccountProvider>
    </>
  );
}
