// Toaster styles are applied via ToastProvider
import { ToastProvider } from '@/components/enhanced-toast-provider';
import type { Metadata } from 'next';
import {
  Geist,
  Geist_Mono,
  Montserrat,
  Roboto_Condensed,
} from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { UISettingsProvider } from '@/components/ui-settings-provider';
// import { LoadingProvider } from '@/components/providers/loading-provider';
import { UserSettingsProvider } from '@/components/user-settings-provider';
import { SettingsEffectsManager } from '@/components/settings-effects-manager';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import './globals.css';
import { SessionProvider } from 'next-auth/react';
// import { AppSplash } from '@/components/app-splash';

export const metadata: Metadata = {
  metadataBase: new URL('https://eosbot.ai'),
  title: {
    default: 'EOS AI - AI-Powered Assistant for EOS Implementation',
    template: '%s | EOS AI',
  },
  description:
    'AI-powered assistant for EOS Worldwide. Transform your business with intelligent V/TO management, Scorecard analysis, and Level 10 Meeting support.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  keywords: [
    'EOS AI',
    'EOS Worldwide',
    'Entrepreneurial Operating System',
    'V/TO',
    'Scorecard',
    'Level 10 Meetings',
    'Traction',
    'business AI',
    'AI assistant',
  ],
  authors: [{ name: 'EOS AI Team' }],
  creator: 'EOS AI',
  publisher: 'EOS AI',
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const robotoCondensed = Roboto_Condensed({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-condensed',
  weight: ['300', '400', '500', '700'], // Light, Regular, Medium, Bold
});

const LIGHT_THEME_COLOR = 'hsl(210deg 48% 97%)';
const DARK_THEME_COLOR = 'hsl(210deg 50% 8%)';
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${robotoCondensed.variable} ${geistMono.variable} ${geist.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="antialiased bg-black dark:bg-zinc-950"
        suppressHydrationWarning
      >
        {/* AppSplash temporarily disabled to isolate white flash source */}
        {/* <AppSplash /> */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider />
          <SessionProvider>
            <UserSettingsProvider>
              <SettingsEffectsManager />
              <UISettingsProvider>
                {/* LoadingProvider temporarily disabled to isolate white flash source */}
                {/* <LoadingProvider /> */}
                {children}
              </UISettingsProvider>
            </UserSettingsProvider>
          </SessionProvider>
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
