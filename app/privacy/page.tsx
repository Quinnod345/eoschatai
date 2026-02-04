import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - EOS AI',
  description: 'Learn about EOS AI\'s commitment to protecting your privacy. Read our comprehensive privacy policy covering data collection, usage, and protection practices.',
  keywords: [
    'EOS AI privacy policy', 'data protection', 'privacy practices', 'data security',
    'user privacy', 'data collection policy', 'privacy rights', 'GDPR compliance'
  ],
  openGraph: {
    title: 'Privacy Policy - EOS AI',
    description: 'Learn about EOS AI\'s commitment to protecting your privacy and data security.',
    url: 'https://eosbot.ai/privacy',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy - EOS AI',
    description: 'Learn about EOS AI\'s commitment to protecting your privacy and data security.',
  },
  robots: {
    index: true,
    follow: false,
  },
  alternates: {
    canonical: 'https://eosbot.ai/privacy',
  },
};


import PrivacyClient from './privacy-client';

export default function PrivacyPolicyPage() {
  return <PrivacyClient />;
}
