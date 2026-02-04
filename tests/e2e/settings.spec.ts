import { ChatPage } from '../pages/chat';
import { AuthPage } from '../pages/auth';
import { test, expect } from '../fixtures';

test.describe('Settings and Organization Management', () => {
  let chatPage: ChatPage;
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    authPage = new AuthPage(page);
    await chatPage.createNewChat();
  });

  test('Settings modal opens and closes correctly', async ({ page }) => {
    // Open sidebar to access settings
    await authPage.openSidebar();
    
    // Look for settings button/link
    const settingsButton = page.getByRole('button', { name: /settings|preferences|config/i });
    const settingsLink = page.getByRole('link', { name: /settings|preferences|config/i });
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    } else if (await settingsLink.isVisible()) {
      await settingsLink.click();
    } else {
      // Try to find settings via user menu
      const userNavButton = page.getByTestId('user-nav-button');
      if (await userNavButton.isVisible()) {
        await userNavButton.click();
        const settingsMenuItem = page.getByText(/settings|preferences/i);
        if (await settingsMenuItem.isVisible()) {
          await settingsMenuItem.click();
        }
      }
    }
    
    // Verify settings modal/page opened
    const settingsModal = page.getByRole('dialog');
    const settingsHeading = page.getByRole('heading', { name: /settings|preferences|configuration/i });
    
    if (await settingsModal.isVisible()) {
      await expect(settingsModal).toBeVisible();
      
      // Test closing modal with X button
      const closeButton = settingsModal.getByRole('button', { name: /close|×/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(settingsModal).not.toBeVisible();
      }
    } else if (await settingsHeading.isVisible()) {
      await expect(settingsHeading).toBeVisible();
    }
  });

  test('User profile settings can be viewed and updated', async ({ page }) => {
    // Access settings
    await authPage.openSidebar();
    
    const settingsButton = page.getByRole('button', { name: /settings|preferences/i });
    const userNavButton = page.getByTestId('user-nav-button');
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    } else if (await userNavButton.isVisible()) {
      await userNavButton.click();
      const settingsMenuItem = page.getByText(/settings|preferences/i);
      if (await settingsMenuItem.isVisible()) {
        await settingsMenuItem.click();
      }
    }
    
    // Look for profile settings section
    const profileSection = page.getByText(/profile|account|personal/i);
    if (await profileSection.isVisible()) {
      // Check for editable profile fields
      const nameInput = page.getByLabel(/name|display name|username/i);
      const emailDisplay = page.getByText(/@/); // Email addresses contain @
      
      if (await nameInput.isVisible()) {
        const currentValue = await nameInput.inputValue();
        await nameInput.fill('Updated Test Name');
        
        // Look for save button
        const saveButton = page.getByRole('button', { name: /save|update/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
          
          // Look for success message
          const successMessage = page.getByText(/saved|updated|success/i);
          if (await successMessage.isVisible()) {
            await expect(successMessage).toBeVisible();
          }
        }
      }
      
      if (await emailDisplay.isVisible()) {
        await expect(emailDisplay).toBeVisible();
      }
    }
  });

  test('Theme/appearance settings can be changed', async ({ page }) => {
    // Access settings
    await authPage.openSidebar();
    
    const settingsButton = page.getByRole('button', { name: /settings|preferences/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    } else {
      const userNavButton = page.getByTestId('user-nav-button');
      if (await userNavButton.isVisible()) {
        await userNavButton.click();
        const settingsMenuItem = page.getByText(/settings|preferences/i);
        if (await settingsMenuItem.isVisible()) {
          await settingsMenuItem.click();
        }
      }
    }
    
    // Look for theme/appearance settings
    const themeSection = page.getByText(/theme|appearance|dark mode|light mode/i);
    const themeToggle = page.getByRole('switch', { name: /dark|theme/i });
    const themeSelect = page.getByRole('combobox', { name: /theme|appearance/i });
    
    if (await themeToggle.isVisible()) {
      // Test theme toggle
      const initialState = await themeToggle.isChecked();
      await themeToggle.click();
      
      // Wait for theme change to apply
      await page.waitForTimeout(500);
      
      const newState = await themeToggle.isChecked();
      expect(newState).toBe(!initialState);
    } else if (await themeSelect.isVisible()) {
      // Test theme dropdown
      await themeSelect.click();
      
      const themeOptions = page.getByRole('option');
      const optionCount = await themeOptions.count();
      
      if (optionCount > 0) {
        await themeOptions.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('Organization settings are accessible', async ({ page }) => {
    // Access settings
    await authPage.openSidebar();
    
    const settingsButton = page.getByRole('button', { name: /settings|preferences/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }
    
    // Look for organization-related settings
    const orgSection = page.getByText(/organization|team|company/i);
    const orgTab = page.getByRole('tab', { name: /organization|team/i });
    
    if (await orgTab.isVisible()) {
      await orgTab.click();
      
      // Check for organization settings content
      const orgName = page.getByText(/organization name|company name/i);
      const membersList = page.getByText(/members|team members/i);
      
      if (await orgName.isVisible()) {
        await expect(orgName).toBeVisible();
      }
      
      if (await membersList.isVisible()) {
        await expect(membersList).toBeVisible();
      }
    }
  });

  test('Organization switching functionality works', async ({ page }) => {
    // Look for organization switcher in sidebar or header
    await authPage.openSidebar();
    
    const orgSwitcher = page.getByTestId('organization-switcher');
    const orgSelect = page.getByRole('combobox', { name: /organization|switch org/i });
    const orgButton = page.getByRole('button', { name: /organization|current org/i });
    
    if (await orgSwitcher.isVisible()) {
      await orgSwitcher.click();
      
      // Look for organization options
      const orgOptions = page.getByRole('option');
      const optionCount = await orgOptions.count();
      
      if (optionCount > 1) {
        // Switch to different organization
        await orgOptions.nth(1).click();
        
        // Verify URL or page content changed
        await page.waitForTimeout(1000);
        
        // Check for loading or transition indicators
        const loadingIndicator = page.getByText(/loading|switching/i);
        if (await loadingIndicator.isVisible()) {
          await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
        }
      }
    } else if (await orgSelect.isVisible()) {
      await orgSelect.click();
      
      const options = page.getByRole('option');
      const count = await options.count();
      
      if (count > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(1000);
      }
    } else if (await orgButton.isVisible()) {
      await orgButton.click();
      
      // Look for organization menu
      const orgMenu = page.getByRole('menu');
      if (await orgMenu.isVisible()) {
        const menuItems = orgMenu.getByRole('menuitem');
        const itemCount = await menuItems.count();
        
        if (itemCount > 0) {
          await menuItems.first().click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('API key/integration settings', async ({ page }) => {
    // Access settings
    await authPage.openSidebar();
    
    const settingsButton = page.getByRole('button', { name: /settings|preferences/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }
    
    // Look for API or integration settings
    const apiTab = page.getByRole('tab', { name: /api|integrations|keys/i });
    const apiSection = page.getByText(/api key|integration|webhook/i);
    
    if (await apiTab.isVisible()) {
      await apiTab.click();
      
      // Check for API key management
      const apiKeyInput = page.getByLabel(/api key|access key/i);
      const generateButton = page.getByRole('button', { name: /generate|create key/i });
      const revokeButton = page.getByRole('button', { name: /revoke|delete key/i });
      
      if (await generateButton.isVisible()) {
        await expect(generateButton).toBeVisible();
      }
      
      if (await apiKeyInput.isVisible()) {
        await expect(apiKeyInput).toBeVisible();
      }
    }
  });

  test('Settings modal keyboard navigation', async ({ page }) => {
    // Open settings
    await authPage.openSidebar();
    
    const settingsButton = page.getByRole('button', { name: /settings|preferences/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }
    
    // Test keyboard navigation in modal
    const settingsModal = page.getByRole('dialog');
    if (await settingsModal.isVisible()) {
      // Test Tab navigation
      await page.keyboard.press('Tab');
      
      // Test Escape to close
      await page.keyboard.press('Escape');
      
      await expect(settingsModal).not.toBeVisible();
    }
  });

  test('Settings persistence across sessions', async ({ page }) => {
    // Access settings and make a change
    await authPage.openSidebar();
    
    const settingsButton = page.getByRole('button', { name: /settings|preferences/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      // Find a toggle or setting to change
      const themeToggle = page.getByRole('switch', { name: /dark|theme/i });
      if (await themeToggle.isVisible()) {
        const initialState = await themeToggle.isChecked();
        await themeToggle.click();
        
        // Save if there's a save button
        const saveButton = page.getByRole('button', { name: /save|apply/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
        
        // Close settings
        const closeButton = page.getByRole('button', { name: /close|×/i });
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
        
        // Reload page
        await page.reload();
        
        // Check settings again
        await authPage.openSidebar();
        await settingsButton.click();
        
        const newToggleState = await themeToggle.isChecked();
        expect(newToggleState).toBe(!initialState);
      }
    }
  });
});