import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features - EOS AI Complete Platform for Business Growth',
  description: 'Explore 100+ AI-powered features for EOS implementation. Document intelligence, custom personas, voice mode, composer studio, and advanced research tools. Everything you need for business success.',
  keywords: [
    'EOS AI features', 'AI chatbot features', 'document intelligence', 'RAG system',
    'custom AI personas', 'voice AI', 'business AI tools', 'EOS implementation features',
    'Level 10 AI', 'Scorecard AI', 'V/TO AI', 'meeting recordings', 'AI composer',
    'business research AI', 'team collaboration AI', 'EOS tool automation'
  ],
  openGraph: {
    title: 'Features - EOS AI Complete Platform for Business Growth',
    description: 'Explore 100+ AI-powered features for EOS implementation. Document intelligence, custom personas, voice mode, composer studio, and advanced research tools.',
    url: 'https://eosbot.ai/features',
    type: 'website',
    images: [
      {
        url: '/images/og-features.jpg',
        width: 1200,
        height: 630,
        alt: 'EOS AI Features - Complete AI Platform for Business',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Features - EOS AI Complete Platform for Business Growth',
    description: 'Explore 100+ AI-powered features for EOS implementation. Document intelligence, custom personas, voice mode, and advanced research tools.',
    images: ['/images/twitter-features.jpg'],
  },
  alternates: {
    canonical: 'https://eosbot.ai/features',
  },
};


import FeaturesClient from './features-client';

export default function FeaturesPage() {
  return <FeaturesClient />;
}
