import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - EOS AI',
  description: 'Read EOS AI\'s Terms of Service to understand the rules and conditions for using our AI-powered platform for business and EOS implementation.',
  keywords: [
    'EOS AI terms of service', 'terms and conditions', 'user agreement', 'service terms',
    'platform usage rules', 'AI service terms', 'legal terms', 'user responsibilities'
  ],
  openGraph: {
    title: 'Terms of Service - EOS AI',
    description: 'Read EOS AI\'s Terms of Service to understand the rules and conditions for using our platform.',
    url: 'https://eosbot.ai/terms',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service - EOS AI',
    description: 'Read EOS AI\'s Terms of Service to understand the rules and conditions for using our platform.',
  },
  robots: {
    index: true,
    follow: false,
  },
  alternates: {
    canonical: 'https://eosbot.ai/terms',
  },
};


import TermsClient from './terms-client';

export default function TermsOfServicePage() {
  return <TermsClient />;
}
