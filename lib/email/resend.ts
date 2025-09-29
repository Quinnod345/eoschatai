import 'server-only';

import { Resend } from 'resend';

let client: Resend | null = null;

export const getResendClient = (): Resend | null => {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set');
    return null;
  }
  client = new Resend(apiKey);
  return client;
};

export const getFromAddress = (): string => {
  return (
    process.env.RESEND_FROM_ADDRESS ||
    process.env.EMAIL_FROM ||
    'EOS AI <onboarding@resend.dev>'
  );
};
