import type { Metadata } from 'next';
import DocsPage from './docs-client';

export const metadata: Metadata = {
  title: 'API Documentation - EOSAI',
  description:
    'Complete API documentation for EOSAI. Build integrations with our OpenAI-compatible REST API for EOS methodology guidance.',
  keywords: [
    'EOSAI API',
    'API documentation',
    'REST API',
    'OpenAI compatible',
    'EOS integration',
    'developer docs',
  ],
  openGraph: {
    title: 'API Documentation - EOSAI',
    description:
      'Build integrations with EOSAI\'s OpenAI-compatible REST API for EOS methodology guidance.',
    url: 'https://eosbot.ai/docs',
    siteName: 'EOS AI',
    type: 'website',
  },
};

export default function Page() {
  return <DocsPage />;
}
