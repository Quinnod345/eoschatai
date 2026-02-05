import type { Metadata } from 'next';
import DocsPage from './docs-client';

export const metadata: Metadata = {
  title: 'API Documentation - EOSAI',
  description:
    'Complete API documentation for EOSAI. Build integrations with our Claude-powered REST API for EOS methodology guidance.',
  keywords: [
    'EOSAI API',
    'API documentation',
    'REST API',
    'Claude powered',
    'EOS integration',
    'developer docs',
  ],
  openGraph: {
    title: 'API Documentation - EOSAI',
    description:
      "Build integrations with EOSAI's Claude-powered REST API for EOS methodology guidance.",
    url: 'https://eosbot.ai/docs',
    siteName: 'EOS AI',
    type: 'website',
  },
};

export default function Page() {
  return <DocsPage />;
}
