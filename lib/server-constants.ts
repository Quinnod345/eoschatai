import 'server-only';

import { generateDummyPassword } from './db/utils';

const normalizeList = (value: string | undefined) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const ensureArray = (value: string[] | undefined, fallback: string[]): string[] =>
  value && value.length > 0 ? value : fallback;

const defaultImplementerEmails = ['quinn@upaway.dev'];
const defaultImplementerDomains = ['@eosworldwide.com'];

export const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  publishableKey:
    process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  priceIds: {
    proMonthly: process.env.PRO_MONTHLY_PRICE_ID || '',
    proAnnual: process.env.PRO_ANNUAL_PRICE_ID || '',
    businessSeatMonthly: process.env.BUSINESS_SEAT_MONTHLY_PRICE_ID || '',
    businessSeatAnnual: process.env.BUSINESS_SEAT_ANNUAL_PRICE_ID || '',
  },
} as const;

const resolvedEmails = normalizeList(process.env.IMPLEMENTER_ALLOWED_EMAILS);
const resolvedDomains = normalizeList(process.env.IMPLEMENTER_ALLOWED_DOMAINS);

export const IMPLEMENTER_ACCESS = {
  allowedEmails: ensureArray(resolvedEmails, defaultImplementerEmails).map((email) =>
    email.toLowerCase(),
  ),
  allowedDomains: ensureArray(resolvedDomains, defaultImplementerDomains).map((domain) =>
    domain.toLowerCase(),
  ),
} as const;

export const DUMMY_PASSWORD = generateDummyPassword();
