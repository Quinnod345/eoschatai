import { expect, test } from '@playwright/test';
import { AuthPage } from '../pages/auth';
import { generateRandomTestUser } from '../helpers';

test.describe('Authentication Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
  });

  test('Register new user successfully', async ({ page }) => {
    const { email, password } = generateRandomTestUser();
    
    await authPage.register(email, password);
    
    // Should show success message
    await authPage.expectToastToContain('Account created successfully!');
    
    // Should redirect to main app
    await expect(page).toHaveURL('/');
    
    // Should be authenticated (check for user elements)
    await authPage.openSidebar();
    const userEmail = page.getByTestId('user-email');
    await expect(userEmail).toBeVisible();
    await expect(userEmail).not.toContainText('Guest');
  });

  test('Login with valid credentials', async ({ page }) => {
    const { email, password } = generateRandomTestUser();
    
    // First register the user
    await authPage.register(email, password);
    await authPage.expectToastToContain('Account created successfully!');
    
    // Logout
    await authPage.logout(email, password);
    
    // Now test login
    await authPage.login(email, password);
    
    // Should redirect to main app
    await expect(page).toHaveURL('/');
    
    // Should be authenticated
    await authPage.openSidebar();
    const userEmail = page.getByTestId('user-email');
    await expect(userEmail).toBeVisible();
    await expect(userEmail).toContainText(email);
  });

  test('Show error for invalid login credentials', async ({ page }) => {
    const invalidEmail = 'nonexistent@example.com';
    const invalidPassword = 'wrongpassword';
    
    await authPage.login(invalidEmail, invalidPassword);
    
    // Should show error message
    await expect(page.getByText(/invalid|incorrect|wrong|error/i)).toBeVisible();
    
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('Navigation between login and register pages', async ({ page }) => {
    // Go to login page
    await authPage.gotoLogin();
    await expect(page).toHaveURL(/\/login/);
    
    // Find link to register page
    const registerLink = page.getByRole('link', { name: /sign up|register|create account/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
      
      // Find link back to login
      const loginLink = page.getByRole('link', { name: /sign in|login|already have account/i });
      if (await loginLink.isVisible()) {
        await loginLink.click();
        await expect(page).toHaveURL(/\/login/);
      }
    }
  });
});
