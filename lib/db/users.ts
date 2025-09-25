import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { org, type Org, planTypeEnum, user, type User } from '@/lib/db/schema';

export type UserWithOrg = {
  user: Pick<
    User,
    | 'id'
    | 'email'
    | 'plan'
    | 'stripeCustomerId'
    | 'orgId'
    | 'entitlements'
    | 'usageCounters'
  >;
  org: (Pick<Org, 'id' | 'plan' | 'seatCount' | 'limits' | 'stripeSubscriptionId'> & {
    limits: Org['limits'];
  }) | null;
};

export const getUserWithOrg = async (userId: string): Promise<UserWithOrg | null> => {
  const [record] = await db
    .select({
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        stripeCustomerId: user.stripeCustomerId,
        orgId: user.orgId,
        entitlements: user.entitlements,
        usageCounters: user.usageCounters,
      },
      org: {
        id: org.id,
        plan: org.plan,
        seatCount: org.seatCount,
        limits: org.limits,
        stripeSubscriptionId: org.stripeSubscriptionId,
      },
    })
    .from(user)
    .leftJoin(org, eq(user.orgId, org.id))
    .where(eq(user.id, userId))
    .limit(1);

  return record ?? null;
};

export const findUserByStripeCustomerId = async (
  customerId: string,
): Promise<User | null> => {
  const [record] = await db
    .select()
    .from(user)
    .where(eq(user.stripeCustomerId, customerId))
    .limit(1);

  return record ?? null;
};

export const listOrgUserIds = async (orgId: string): Promise<string[]> => {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.orgId, orgId));
  return rows.map((row) => row.id);
};

export const updateUserPlan = async (
  userId: string,
  plan: Org['plan'],
  stripeCustomerId?: string | null,
) => {
  await db
    .update(user)
    .set({
      plan,
      stripeCustomerId: stripeCustomerId ?? undefined,
    })
    .where(eq(user.id, userId));
};

export const updateOrgSubscription = async (
  orgId: string,
  plan: Org['plan'],
  seatCount: number,
  stripeSubscriptionId: string | null,
) => {
  await db
    .update(org)
    .set({
      plan,
      seatCount,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
    })
    .where(eq(org.id, orgId));
};

export const resetUserPlanToFree = async (userId: string) => {
  await updateUserPlan(userId, planTypeEnum.enumValues[0]);
};

export const resetOrgPlanToFree = async (orgId: string) => {
  await updateOrgSubscription(orgId, planTypeEnum.enumValues[0], 1, null);
  await db
    .update(user)
    .set({ plan: planTypeEnum.enumValues[0] })
    .where(eq(user.orgId, orgId));
};
