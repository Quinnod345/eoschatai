import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enterprise Solutions - Advanced AI Tools for Business Growth | EOS AI',
  description: 'Discover enterprise-grade AI solutions for deep research, content creation, and team collaboration. Nexus Research Engine, Composer Studio, and advanced analytics for scaling businesses.',
  keywords: [
    'enterprise AI solutions', 'business AI tools', 'Nexus research engine', 'AI composer studio',
    'team collaboration AI', 'enterprise analytics', 'business intelligence AI',
    'advanced AI features', 'B2B AI solutions', 'corporate AI assistant',
    'enterprise EOS tools', 'business automation platform', 'AI research tools'
  ],
  openGraph: {
    title: 'Enterprise Solutions - Advanced AI Tools for Business Growth | EOS AI',
    description: 'Discover enterprise-grade AI solutions for deep research, content creation, and team collaboration. Nexus Research Engine, Composer Studio, and advanced analytics.',
    url: 'https://eosbot.ai/solutions',
    type: 'website',
    images: [
      {
        url: '/images/og-solutions.jpg',
        width: 1200,
        height: 630,
        alt: 'EOS AI Enterprise Solutions - Advanced AI Tools for Business',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enterprise Solutions - Advanced AI Tools for Business Growth | EOS AI',
    description: 'Discover enterprise-grade AI solutions for deep research, content creation, and team collaboration.',
    images: ['/images/twitter-solutions.jpg'],
  },
  alternates: {
    canonical: 'https://eosbot.ai/solutions',
  },
};


import SolutionsClient from './solutions-client';

export default function SolutionsPage() {
  return <SolutionsClient />;
}
