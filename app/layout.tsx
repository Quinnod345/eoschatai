// Toaster styles are applied via ToastProvider
import { ToastProvider } from '@/components/enhanced-toast-provider';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { UISettingsProvider } from '@/components/ui-settings-provider';
import { LoadingProvider } from '@/components/providers/loading-provider';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  metadataBase: new URL('https://app.eosbot.ai'),
  title: 'EOS AI',
  description: 'AI-powered chat assistant for EOS Worldwide.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
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
        className="antialiased bg-white dark:bg-zinc-950"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider />
          <SessionProvider>
            <UISettingsProvider>
              <LoadingProvider />
              {children}
            </UISettingsProvider>
          </SessionProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
