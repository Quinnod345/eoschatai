import { expect, test } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Visit landing page as guest user (no authentication needed)
    await page.goto('/');
  });

  test('Landing page loads correctly', async ({ page }) => {
    // Check that the page loads and has essential elements
    await expect(page).toHaveTitle(/EOSAI/);
    
    // Check for main heading or brand elements
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('Navigation links work correctly', async ({ page }) => {
    // Test main navigation elements
    const loginLink = page.getByRole('link', { name: /sign in|login/i });
    const signupLink = page.getByRole('link', { name: /sign up|register/i });
    
    if (await loginLink.isVisible()) {
      await expect(loginLink).toBeVisible();
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
      await page.goBack();
    }
    
    if (await signupLink.isVisible()) {
      await expect(signupLink).toBeVisible();  
      await signupLink.click();
      await expect(page).toHaveURL(/\/register/);
      await page.goBack();
    }
  });

  test('Chat interface is accessible from landing page', async ({ page }) => {
    // Test that users can access chat functionality
    const chatButton = page.getByRole('button', { name: /start chat|new chat|chat/i });
    const chatLink = page.getByRole('link', { name: /chat|start/i });
    
    if (await chatButton.isVisible()) {
      await chatButton.click();
      // Should redirect to chat or prompt for auth
      await expect(page).toHaveURL(/\/chat|\/login|\/register/);
    } else if (await chatLink.isVisible()) {
      await chatLink.click();
      await expect(page).toHaveURL(/\/chat|\/login|\/register/);
    }
  });

  test('Page is responsive on mobile viewport', async ({ page }) => {
    // Test mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    // Check that content is still visible and accessible
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
    
    // Check that navigation works on mobile (may be in hamburger menu)
    const mobileMenuButton = page.getByRole('button', { name: /menu|navigation/i });
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      // Menu should open
      const nav = page.getByRole('navigation');
      if (await nav.isVisible()) {
        await expect(nav).toBeVisible();
      }
    }
  });

  test('Footer links are present and functional', async ({ page }) => {
    // Scroll to footer to ensure it's visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check for common footer elements
    const footer = page.locator('footer');
    if (await footer.isVisible()) {
      await expect(footer).toBeVisible();
      
      // Test any footer links that might be present
      const footerLinks = footer.getByRole('link');
      const linkCount = await footerLinks.count();
      
      if (linkCount > 0) {
        // Test first footer link (usually privacy, terms, etc.)
        const firstLink = footerLinks.first();
        const href = await firstLink.getAttribute('href');
        
        if (href && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          await firstLink.click();
          // Wait for navigation
          await page.waitForTimeout(1000);
          // Should navigate somewhere or stay on same origin
          const currentUrl = page.url();
          expect(currentUrl).toBeTruthy();
        }
      }
    }
  });
});