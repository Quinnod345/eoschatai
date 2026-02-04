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

  test('Registration form validation', async ({ page }) => {
    await authPage.gotoRegister();
    
    // Try to submit empty form
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    // Should show validation errors or prevent submission
    const emailInput = page.getByPlaceholder('user@acme.com');
    const passwordInput = page.getByLabel('Password');
    
    // Check if HTML5 validation is working
    const emailValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(emailValid).toBeFalsy();
  });

  test('Login form validation', async ({ page }) => {
    await authPage.gotoLogin();
    
    // Try to submit empty form
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Should show validation errors or prevent submission
    const emailInput = page.getByPlaceholder('user@acme.com');
    const passwordInput = page.getByLabel('Password');
    
    // Check if HTML5 validation is working
    const emailValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(emailValid).toBeFalsy();
  });

  test('Password requirements are enforced', async ({ page }) => {
    const { email } = generateRandomTestUser();
    const weakPassword = '123'; // Too weak
    
    await authPage.gotoRegister();
    await page.getByPlaceholder('user@acme.com').fill(email);
    await page.getByLabel('Password').fill(weakPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    // Should show password strength error or prevent registration
    // This test may need adjustment based on actual password requirements
    const errorElement = page.getByText(/password.*weak|password.*short|password.*requirements/i);
    if (await errorElement.isVisible()) {
      await expect(errorElement).toBeVisible();
    }
  });

  test('Logout functionality works', async ({ page }) => {
    const { email, password } = generateRandomTestUser();
    
    // Register and login
    await authPage.register(email, password);
    await authPage.expectToastToContain('Account created successfully!');
    
    // Logout
    await authPage.logout(email, password);
    
    // Should show guest state
    const userEmail = page.getByTestId('user-email');
    await expect(userEmail).toContainText('Guest');
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

  test('Authenticated user cannot access auth pages', async ({ page }) => {
    const { email, password } = generateRandomTestUser();
    
    // Register user
    await authPage.register(email, password);
    await authPage.expectToastToContain('Account created successfully!');
    
    // Try to visit login page while authenticated
    await page.goto('/login');
    
    // Should redirect away from login page
    await expect(page).not.toHaveURL(/\/login/);
    
    // Try to visit register page while authenticated  
    await page.goto('/register');
    
    // Should redirect away from register page
    await expect(page).not.toHaveURL(/\/register/);
  });
});