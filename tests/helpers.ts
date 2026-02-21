import fs from 'node:fs';
import path from 'node:path';
import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
} from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { ChatPage } from './pages/chat';

// AI SDK 5: generateId no longer takes length argument
function generateId(length = 12): string {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

const BASE_URL = 'http://localhost:3000';
const CSRF_HEADERS = {
  origin: BASE_URL,
  referer: `${BASE_URL}/chat`,
};

export type PlanType = 'free' | 'pro' | 'business';
export type UsageCounters = Record<string, number>;

type AccessContext = {
  user: {
    id: string;
    plan: PlanType;
    usageCounters: UsageCounters;
  };
  entitlements: {
    features: Record<string, any>;
  };
};

async function callDebugEndpoint(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; accessContext: AccessContext }> {
  const response = await request.post(`${BASE_URL}/api/debug/test-user`, {
    data: body,
    headers: CSRF_HEADERS,
  });

  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(
      `[debug/test-user] ${response.status()} ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

export type UserContext = {
  context: BrowserContext;
  page: Page;
  request: APIRequestContext;
  userId: string;
  email: string;
  password: string;
  plan: PlanType;
};

export async function createAuthenticatedContext({
  browser,
  name,
  chatModel = 'chat-model',
  plan = 'free',
}: {
  browser: Browser;
  name: string;
  chatModel?: 'chat-model';
  plan?: PlanType;
}): Promise<UserContext> {
  const directory = path.join(__dirname, '../playwright/.sessions');

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const storageFile = path.join(directory, `${name}.json`);

  const context = await browser.newContext({
    extraHTTPHeaders: CSRF_HEADERS,
  });
  const page = await context.newPage();

  const email = `test-${name}-${generateId(6)}@playwright.com`;
  const password = `Aa1!${generateId(12)}`;

  await page.goto('http://localhost:3000/register');
  await page.getByPlaceholder('user@acme.com').click();
  await page.getByPlaceholder('user@acme.com').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page
    .getByRole('checkbox', {
      name: /I agree to the Terms of Service and Privacy Policy/i,
    })
    .check();
  await page.getByRole('button', { name: /Create account/i }).click();

  // Registration occasionally does not auto-navigate in test runs,
  // so explicitly confirm authentication by driving through login/chat.
  await page.goto('http://localhost:3000/login');
  if (page.url().includes('/login')) {
    await page.getByPlaceholder('user@acme.com').fill(email);
    await page.locator('input[name="password"]').fill(password);
    const signInResponse = page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/auth/callback/credentials') &&
          response.request().method() === 'POST',
        { timeout: 30_000 },
      )
      .catch(() => null);
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await signInResponse;
  }

  if (!/\/chat(?:\?.*)?$/.test(page.url())) {
    await page.goto('http://localhost:3000/chat');
  }
  await expect(page).toHaveURL(/\/chat(?:\?.*)?$/);

  const chatPage = new ChatPage(page);
  await chatPage.createNewChat();

  await page.waitForTimeout(1000);
  await context.storageState({ path: storageFile });
  await page.close();

  const newContext = await browser.newContext({
    storageState: storageFile,
    extraHTTPHeaders: CSRF_HEADERS,
  });
  const newPage = await newContext.newPage();
  const sessionResponse = await newContext.request.get(
    `${BASE_URL}/api/auth/session`,
  );
  const session = await sessionResponse.json();
  const userId = session?.user?.id as string | undefined;
  const userEmail = (session?.user?.email as string | undefined) ?? email;

  if (!userId) {
    throw new Error('Failed to resolve authenticated user from session');
  }

  if (plan !== 'free') {
    const debugResult = await callDebugEndpoint(newContext.request, {
      action: 'set-plan',
      plan,
    });
    plan = debugResult.accessContext.user.plan;
  }

  return {
    context: newContext,
    page: newPage,
    request: newContext.request,
    userId,
    email: userEmail,
    password,
    plan,
  };
}

export async function setContextPlan(
  userContext: UserContext,
  plan: PlanType,
): Promise<void> {
  const debugResult = await callDebugEndpoint(userContext.request, {
    action: 'set-plan',
    plan,
  });
  userContext.plan = debugResult.accessContext.user.plan;
}

export async function getContextAccess(
  userContext: UserContext,
): Promise<AccessContext> {
  const debugResult = await callDebugEndpoint(userContext.request, {
    action: 'get-access-context',
  });
  return debugResult.accessContext;
}

export async function setContextUsage(
  userContext: UserContext,
  counters: Partial<UsageCounters>,
): Promise<UsageCounters> {
  const debugResult = await callDebugEndpoint(userContext.request, {
    action: 'set-usage',
    usageCounters: counters,
  });
  return debugResult.accessContext.user.usageCounters;
}

export async function resetContextUsage(
  userContext: UserContext,
): Promise<UsageCounters> {
  const debugResult = await callDebugEndpoint(userContext.request, {
    action: 'reset-usage',
  });
  return debugResult.accessContext.user.usageCounters;
}

export function generateRandomTestUser() {
  const email = `test-${Date.now()}-${generateId(6)}@playwright.com`;
  const password = `Aa1!${generateId(12)}`;

  return {
    email,
    password,
  };
}
