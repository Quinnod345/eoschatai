import 'server-only';

import { getMemberByEmail, mapCircleTierToPlan } from '@/lib/integrations/circle';

export type CircleResolvedPlan = 'free' | 'pro' | 'business';
type ResolveCirclePlanOptions = {
  fallbackOnLookupError?: CircleResolvedPlan;
  alternateEmail?: string | null;
};

export const resolveCirclePlanFromEmail = async (
  email: string | null,
  context: string,
  options?: ResolveCirclePlanOptions,
): Promise<CircleResolvedPlan> => {
  const fallbackOnLookupError = options?.fallbackOnLookupError ?? 'free';
  const normalizedPrimaryEmail = email?.trim().toLowerCase();
  const normalizedAlternateEmail = options?.alternateEmail?.trim().toLowerCase();
  const lookupEmails = Array.from(
    new Set(
      [normalizedPrimaryEmail, normalizedAlternateEmail].filter(
        (candidate): candidate is string =>
          Boolean(candidate?.includes('@')),
      ),
    ),
  );

  if (lookupEmails.length === 0) {
    return 'free';
  }

  let hadLookupError = false;

  for (const lookupEmail of lookupEmails) {
    try {
      const member = await getMemberByEmail(lookupEmail);
      if (!member) {
        continue;
      }

      return member.mappedPlan ?? mapCircleTierToPlan(member.tierName) ?? 'free';
    } catch (error) {
      hadLookupError = true;
      console.warn(`[${context}] Circle plan lookup failed for email candidate`, {
        lookupEmail,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (hadLookupError) {
    console.warn(
      `[${context}] Circle plan re-lookup failed, falling back to existing plan`,
      {
        lookupEmails,
        fallbackOnLookupError,
      },
    );
    return fallbackOnLookupError;
  }

  return 'free';
};
