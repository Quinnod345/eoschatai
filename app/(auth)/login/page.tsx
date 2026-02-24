import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - EOS AI',
  description: 'Sign in to your EOS AI account and access your AI-powered assistant for EOS implementation. Get instant help with V/TO creation, Level 10 meetings, and business growth.',
  keywords: [
    'EOS AI login', 'sign in', 'EOS AI account', 'AI assistant login',
    'business AI access', 'EOS tools login', 'AI chatbot signin'
  ],
  openGraph: {
    title: 'Sign In - EOS AI',
    description: 'Sign in to your EOS AI account and access your AI-powered assistant for EOS implementation.',
    url: 'https://eosbot.ai/login',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Sign In - EOS AI',
    description: 'Sign in to your EOS AI account and access your AI-powered assistant for EOS implementation.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://eosbot.ai/login',
  },
};


import LoginClient from './login-client';

export default function Page() {
  return <LoginClient />;
}
