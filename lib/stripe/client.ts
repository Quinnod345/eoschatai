import 'server-only';

import Stripe from 'stripe';

import { STRIPE_CONFIG } from '@/lib/server-constants';

let stripeClient: Stripe | null | undefined;

export const getStripeClient = (): Stripe | null => {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  const secretKey = STRIPE_CONFIG.secretKey;
  if (!secretKey) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
    appInfo: {
      name: 'EOS Chat AI',
      version: '1.0.0',
    },
  });

  return stripeClient;
};
