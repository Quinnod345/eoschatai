// Polyfill for self in Node.js environment
if (typeof self === 'undefined' && typeof global !== 'undefined') {
  (global as any).self = global;
}

import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { UISettingsProvider } from '@/components/ui-settings-provider';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  metadataBase: new URL('https://eosbot.ai'),
  title: 'EOS AI',
  description: 'AI-powered chat assistant for EOS Worldwide.',
  icons: {
    icon: '/images/eos-logo.png',
    shortcut: '/images/eos-logo.png',
    apple: '/images/eos-logo.png',
  },
  verification: {
    google: 'google-site-verification-code-replace-this',
  },
  keywords: ['AI', 'chatbot', 'EOS', 'assistant', 'artificial intelligence'],
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
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <meta
          name="google-site-verification"
          content="google-site-verification-code-replace-this"
        />
      </head>
      <body
        className="antialiased bg-gradient-to-br from-blue-50 via-white to-orange-50 dark:from-eos-navy dark:via-eos-navyDark dark:to-black"
        suppressHydrationWarning
      >
        {/* EOS-themed background patterns */}
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(#ff7600_1px,transparent_1px)] dark:bg-[radial-gradient(#ff9033_1px,transparent_1px)] [background-size:25px_25px] opacity-[0.15]" />
        <div className="fixed inset-0 z-[-2] bg-animate-pattern bg-[linear-gradient(45deg,rgba(0,46,93,0.05)_25%,transparent_25%,transparent_50%,rgba(0,46,93,0.05)_50%,rgba(0,46,93,0.05)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,118,0,0.1)_25%,transparent_25%,transparent_50%,rgba(255,118,0,0.1)_50%,rgba(255,118,0,0.1)_75%,transparent_75%,transparent)] [background-size:64px_64px]" />

        {/* Animated gradient spheres and floating elements */}
        <div className="fixed left-[10%] top-[15%] z-[-3] h-[300px] w-[300px] rounded-full bg-gradient-to-r from-eos-orange/20 to-eos-orangeLight/10 blur-[100px] dark:from-eos-orange/10 dark:to-eos-orangeLight/5 eos-float stagger-1" />
        <div className="fixed right-[10%] bottom-[15%] z-[-3] h-[250px] w-[250px] rounded-full bg-gradient-to-r from-eos-navy/20 to-eos-navyLight/10 blur-[100px] dark:from-eos-navy/10 dark:to-eos-navyLight/5 eos-float stagger-3" />
        <div className="fixed right-[20%] top-[25%] z-[-3] h-[200px] w-[200px] rounded-full bg-gradient-to-r from-eos-orangeLight/15 to-eos-navy/10 blur-[80px] dark:from-eos-orangeLight/8 dark:to-eos-navy/5 eos-float stagger-2" />

        {/* Additional floating elements */}
        <div className="fixed left-[25%] bottom-[20%] z-[-3] h-[150px] w-[150px] rounded-[40%] bg-gradient-to-r from-eos-navyLight/15 to-eos-navy/10 blur-[60px] dark:from-eos-navyLight/8 dark:to-eos-navy/5 float-rotate stagger-4" />
        <div className="fixed right-[30%] top-[40%] z-[-3] h-[100px] w-[100px] rounded-[30%] bg-gradient-to-r from-eos-orange/15 to-eos-orangeLight/10 blur-[40px] dark:from-eos-orange/8 dark:to-eos-orangeLight/5 float-rotate stagger-5" />

        {/* Decorative floating shapes */}
        <div className="fixed left-[15%] top-[60%] z-[-3] h-[80px] w-[80px] rounded-[50%] border-2 border-eos-orange/20 dark:border-eos-orange/10 bg-transparent float-rotate stagger-2 opacity-70" />
        <div className="fixed right-[15%] top-[10%] z-[-3] h-[60px] w-[60px] rounded-[30%] border-2 border-eos-navy/20 dark:border-eos-navy/10 bg-transparent float-rotate stagger-3 opacity-70" />
        <div className="fixed left-[40%] bottom-[10%] z-[-3] h-[40px] w-[40px] rounded-full border-2 border-eos-orangeLight/20 dark:border-eos-orangeLight/10 bg-transparent float-rotate stagger-4 opacity-70" />

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster
            position="top-center"
            expand={true}
            duration={4000}
            gap={8}
            visibleToasts={3}
            closeButton={true}
            toastOptions={{
              style: {
                padding: '16px',
                borderRadius: '16px',
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                fontSize: '14px',
                boxShadow:
                  '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              },
              className: 'spring-transition eos-glass',
              descriptionClassName: 'text-sm',
            }}
          />
          <SessionProvider>
            <UISettingsProvider>{children}</UISettingsProvider>
          </SessionProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
