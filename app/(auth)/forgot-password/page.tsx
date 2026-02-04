import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password - EOS AI',
  description: 'Forgot your EOS AI password? Reset it here to regain access to your AI-powered assistant for EOS implementation and business tools.',
  keywords: [
    'reset password', 'forgot password', 'EOS AI password recovery', 'account recovery',
    'password reset', 'login help', 'account access'
  ],
  openGraph: {
    title: 'Reset Password - EOS AI',
    description: 'Reset your EOS AI password to regain access to your AI-powered business assistant.',
    url: 'https://eosbot.ai/forgot-password',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Reset Password - EOS AI',
    description: 'Reset your EOS AI password to regain access to your AI-powered business assistant.',
  },
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://eosbot.ai/forgot-password',
  },
};


import ForgotPasswordClient from './forgot-password-client';

export default function Page() {
  return <ForgotPasswordClient />;
}
