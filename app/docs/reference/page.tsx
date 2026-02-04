import type { Metadata } from 'next';
import ApiReferencePage from './api-reference-client';

export const metadata: Metadata = {
  title: 'API Reference - EOSAI',
  description:
    'Interactive API reference documentation for EOSAI. Explore endpoints, try requests, and view schemas.',
  keywords: [
    'EOSAI API reference',
    'OpenAPI',
    'Swagger',
    'REST API',
    'API endpoints',
    'developer documentation',
  ],
  openGraph: {
    title: 'API Reference - EOSAI',
    description:
      'Interactive API reference documentation for EOSAI.',
    url: 'https://eosbot.ai/docs/reference',
    siteName: 'EOS AI',
    type: 'website',
  },
};

export default function Page() {
  return <ApiReferencePage />;
}
