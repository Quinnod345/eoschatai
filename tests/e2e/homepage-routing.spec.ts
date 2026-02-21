import type { Request } from '@playwright/test';
import { expect, test } from '../fixtures';

test.describe('Authenticated homepage routing', () => {
  test('Redirect authenticated users from root to /chat', async ({
    adaContext,
  }) => {
    const response = await adaContext.page.goto('/');

    if (!response) {
      throw new Error('Failed to load page');
    }

    await expect(adaContext.page).toHaveURL(/\/chat(?:\?.*)?$/);

    let request: Request | null = response.request();
    const chain: string[] = [];

    while (request) {
      chain.unshift(request.url());
      request = request.redirectedFrom();
    }

    expect(chain[0]).toBe('http://localhost:3000/');
    expect(chain[chain.length - 1]).toBe('http://localhost:3000/chat');
  });

  test('Allow intentional homepage access with from=chat', async ({
    adaContext,
  }) => {
    await adaContext.page.goto('/?from=chat');
    await expect(adaContext.page).toHaveURL(/\/\?from=chat$/);

    const heading = adaContext.page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });
});
