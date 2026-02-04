import { Metadata } from 'next';
import Home from './landing-page-client';

export const metadata: Metadata = {
  title: 'EOS AI - AI-Powered Assistant for EOS Implementation & Business Growth',
  description: 'Transform your EOS implementation with AI-powered assistance. Get intelligent help with V/TO creation, Level 10 meetings, Scorecard tracking, and accelerated business growth. Start your free trial today.',
  keywords: [
    'EOS AI assistant', 'EOS implementation', 'artificial intelligence for business',
    'Level 10 meetings', 'V/TO creation', 'Scorecard tracking', 'EOS tools',
    'business growth AI', 'Accountability Chart', 'EOS Implementer tools',
    'entrepreneurial operating system', 'business automation', 'AI chatbot for EOS'
  ],
  openGraph: {
    title: 'EOS AI - AI-Powered Assistant for EOS Implementation & Business Growth',
    description: 'Transform your EOS implementation with AI-powered assistance. Get intelligent help with V/TO creation, Level 10 meetings, Scorecard tracking, and accelerated business growth.',
    url: 'https://eosbot.ai',
    type: 'website',
    images: [
      {
        url: '/images/og-homepage.jpg',
        width: 1200,
        height: 630,
        alt: 'EOS AI Homepage - AI Assistant for EOS Implementation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EOS AI - AI-Powered Assistant for EOS Implementation & Business Growth',
    description: 'Transform your EOS implementation with AI-powered assistance. Get intelligent help with V/TO creation, Level 10 meetings, and business growth.',
    images: ['/images/twitter-homepage.jpg'],
  },
  alternates: {
    canonical: 'https://eosbot.ai',
  },
};

export default function Page() {
  return <Home />;
}


