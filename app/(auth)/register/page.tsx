import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up Free - Start Your AI-Powered EOS Journey | EOS AI',
  description: 'Create your free EOS AI account and transform your business implementation. Get instant access to AI-powered V/TO creation, Level 10 meeting assistance, and advanced business tools.',
  keywords: [
    'EOS AI signup', 'free EOS AI account', 'AI assistant registration', 'EOS AI trial',
    'business AI sign up', 'free AI chatbot', 'EOS implementation trial',
    'AI business tools signup', 'free business AI', 'EOS AI free trial'
  ],
  openGraph: {
    title: 'Sign Up Free - Start Your AI-Powered EOS Journey | EOS AI',
    description: 'Create your free EOS AI account and transform your business implementation. Get instant access to AI-powered tools and assistance.',
    url: 'https://eosbot.ai/register',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Sign Up Free - Start Your AI-Powered EOS Journey | EOS AI',
    description: 'Create your free EOS AI account and transform your business implementation.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://eosbot.ai/register',
  },
};


import RegisterClient from './register-client';

export default function Page() {
  return <RegisterClient />;
}
