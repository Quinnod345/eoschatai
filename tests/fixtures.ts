import { expect as baseExpect, test as baseTest } from '@playwright/test';
import { createAuthenticatedContext, type UserContext } from './helpers';
import { getUnixTime } from 'date-fns';

interface Fixtures {
  adaContext: UserContext;
  babbageContext: UserContext;
  curieContext: UserContext;
  freeContext: UserContext;
  proContext: UserContext;
  businessContext: UserContext;
}

export const test = baseTest.extend<{}, Fixtures>({
  adaContext: [
    async ({ browser }, use, workerInfo) => {
      const ada = await createAuthenticatedContext({
        browser,
        name: `ada-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
      });

      await use(ada);
      await ada.context.close();
    },
    { scope: 'worker' },
  ],
  babbageContext: [
    async ({ browser }, use, workerInfo) => {
      const babbage = await createAuthenticatedContext({
        browser,
        name: `babbage-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
      });

      await use(babbage);
      await babbage.context.close();
    },
    { scope: 'worker' },
  ],
  curieContext: [
    async ({ browser }, use, workerInfo) => {
      const curie = await createAuthenticatedContext({
        browser,
        name: `curie-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
      });

      await use(curie);
      await curie.context.close();
    },
    { scope: 'worker' },
  ],
  freeContext: [
    async ({ browser }, use, workerInfo) => {
      const free = await createAuthenticatedContext({
        browser,
        name: `free-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
        plan: 'free',
      });

      await use(free);
      await free.context.close();
    },
    { scope: 'worker' },
  ],
  proContext: [
    async ({ browser }, use, workerInfo) => {
      const pro = await createAuthenticatedContext({
        browser,
        name: `pro-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
        plan: 'pro',
      });

      await use(pro);
      await pro.context.close();
    },
    { scope: 'worker' },
  ],
  businessContext: [
    async ({ browser }, use, workerInfo) => {
      const business = await createAuthenticatedContext({
        browser,
        name: `business-${workerInfo.workerIndex}-${getUnixTime(new Date())}`,
        plan: 'business',
      });

      await use(business);
      await business.context.close();
    },
    { scope: 'worker' },
  ],
});

export const expect = baseExpect;
