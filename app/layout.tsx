import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { UISettingsProvider } from '@/components/ui-settings-provider';

import './globals.css';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  metadataBase: new URL('https://chat.vercel.ai'),
  title: 'EOS AI',
  description: 'AI-powered chat assistant for EOS Worldwide.',
  icons: {
    icon: '/images/eos-logo.png',
    shortcut: '/images/eos-logo.png',
    apple: '/images/eos-logo.png',
  },
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

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
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
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body
        className="antialiased bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-slate-900"
        suppressHydrationWarning
      >
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
        <div className="fixed inset-0 z-[-2] bg-animate-pattern bg-[linear-gradient(45deg,rgba(125,211,252,0.1)_25%,transparent_25%,transparent_50%,rgba(125,211,252,0.1)_50%,rgba(125,211,252,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(31,41,55,0.3)_25%,transparent_25%,transparent_50%,rgba(31,41,55,0.3)_50%,rgba(31,41,55,0.3)_75%,transparent_75%,transparent)] [background-size:64px_64px]" />
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
                borderRadius: '12px',
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                fontSize: '14px',
                boxShadow:
                  '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              },
              className: 'spring-transition',
              descriptionClassName: 'text-sm',
            }}
          />
          <SessionProvider>
            <UISettingsProvider>{children}</UISettingsProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
