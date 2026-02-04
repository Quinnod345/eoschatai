import type { Metadata } from 'next';
import Home from './landing-page-client';

export const metadata: Metadata = {
  title: 'EOS AI - Your AI Assistant for EOS Implementation & Business Growth',
  description:
    'Transform your EOS implementation with AI-powered insights. Manage your V/TO, Scorecard, and Level 10 Meetings with intelligent automation. Get started free.',
  keywords: [
    'EOS',
    'Entrepreneurial Operating System',
    'AI assistant',
    'V/TO',
    'Scorecard',
    'Level 10 Meetings',
    'business growth',
    'EOS implementation',
    'Traction',
    'EOS Worldwide',
    'business operating system',
  ],
  openGraph: {
    title: 'EOS AI - Your AI Assistant for EOS Implementation',
    description:
      'Transform your EOS implementation with AI-powered insights. Manage V/TO, Scorecard, and Level 10 Meetings with intelligent automation.',
    url: 'https://eosbot.ai',
    siteName: 'EOS AI',
    images: [
      {
        url: '/images/eosai.png',
        width: 1200,
        height: 630,
        alt: 'EOS AI - AI-Powered Assistant for EOS Implementation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EOS AI - Your AI Assistant for EOS Implementation',
    description:
      'Transform your EOS implementation with AI-powered insights. Get started free.',
    images: ['/images/eosai.png'],
  },
  alternates: {
    canonical: 'https://eosbot.ai',
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
};

export default function Page() {
  return <Home />;
}

