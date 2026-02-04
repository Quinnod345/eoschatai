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
import { LoadingProvider } from '@/components/providers/loading-provider';
import { UserSettingsProvider } from '@/components/user-settings-provider';
import { SettingsEffectsManager } from '@/components/settings-effects-manager';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  metadataBase: new URL('https://eosbot.ai'),
  title: {
    default: 'EOS AI - AI-Powered Assistant for EOS Implementation & Business Growth',
    template: '%s | EOS AI'
  },
  description: 'Transform your EOS implementation with AI. Get intelligent assistance for V/TO creation, Level 10 meetings, Scorecard tracking, and business growth. Start free today.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  verification: {
    google: 'google-site-verification-code-replace-this',
  },
  keywords: [
    'EOS', 'EOS implementation', 'EOS AI', 'business AI assistant', 
    'Level 10 meetings', 'V/TO', 'Vision Traction Organizer', 'Scorecard',
    'Accountability Chart', 'business growth', 'AI chatbot', 'EOS tools',
    'entrepreneurial operating system', 'business coaching', 'AI assistant',
    'EOS Implementer', 'EOS Integrator', 'business management'
  ],
  authors: [{ name: 'EOS AI Team', url: 'https://eosbot.ai' }],
  creator: 'EOS AI',
  publisher: 'EOS AI',
  category: 'Business Software',
  classification: 'Business AI Assistant',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://eosbot.ai',
    title: 'EOS AI - AI-Powered Assistant for EOS Implementation & Business Growth',
    description: 'Transform your EOS implementation with AI. Get intelligent assistance for V/TO creation, Level 10 meetings, Scorecard tracking, and business growth. Start free today.',
    siteName: 'EOS AI',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'EOS AI - AI-Powered Assistant for EOS Implementation',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@eosai',
    creator: '@eosai',
    title: 'EOS AI - AI-Powered Assistant for EOS Implementation & Business Growth',
    description: 'Transform your EOS implementation with AI. Get intelligent assistance for V/TO creation, Level 10 meetings, Scorecard tracking, and business growth. Start free today.',
    images: ['/images/twitter-card.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://eosbot.ai',
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
      data-glass-effects="disabled"
      data-eos-gradients="disabled"
    >
      <head>
        {(process.env.NODE_ENV === 'development' ||
          process.env.VERCEL_ENV === 'preview') && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            data-recording-token="ExoKs5MrAz4fUbTBIqlp9eONnNMv0xV7MbUqgfi3"
            data-is-production-environment="false"
            src="https://snippet.meticulous.ai/v1/meticulous.js"
          />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <meta
          name="google-site-verification"
          content="google-site-verification-code-replace-this"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "EOS AI",
              "description": "AI-powered assistant for EOS implementation and business growth. Intelligent assistance for V/TO creation, Level 10 meetings, Scorecard tracking, and more.",
              "url": "https://eosbot.ai",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "priceValidUntil": "2025-12-31",
                "availability": "https://schema.org/InStock"
              },
              "publisher": {
                "@type": "Organization",
                "@id": "https://eosbot.ai/#organization",
                "name": "EOS AI",
                "url": "https://eosbot.ai",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://eosbot.ai/favicon.ico"
                },
                "contactPoint": {
                  "@type": "ContactPoint",
                  "contactType": "customer support",
                  "url": "https://eosbot.ai/contact"
                },
                "sameAs": [
                  "https://twitter.com/eosai"
                ]
              },
              "featureList": [
                "AI-powered EOS implementation",
                "V/TO creation and management",
                "Level 10 meeting assistance",
                "Scorecard tracking and analysis",
                "Accountability Chart creation",
                "Document intelligence and RAG",
                "Voice mode and meeting recordings",
                "Custom AI personas",
                "Team collaboration tools",
                "Calendar integration"
              ],
              "screenshot": "https://eosbot.ai/images/app-screenshot.jpg",
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "reviewCount": "127",
                "bestRating": "5",
                "worstRating": "1"
              }
            }),
          }}
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
            <UserSettingsProvider>
              <SettingsEffectsManager />
              <UISettingsProvider>
                <LoadingProvider />
                {children}
              </UISettingsProvider>
            </UserSettingsProvider>
          </SessionProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
