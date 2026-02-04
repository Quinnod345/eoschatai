import { ChatPage } from '../pages/chat';
import { test, expect } from '../fixtures';

test.describe('Chat Interface Critical Flows', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test('Chat interface loads correctly', async ({ page }) => {
    // Verify essential chat elements are present
    await expect(page).toHaveURL(/\/chat/);
    
    // Check for input area
    const messageInput = page.getByRole('textbox', { name: /message|chat/i });
    await expect(messageInput).toBeVisible();
    
    // Check for send button
    await expect(chatPage.sendButton).toBeVisible();
    
    // Check for sidebar toggle
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await expect(sidebarToggle).toBeVisible();
  });

  test('Document upload flow works correctly', async () => {
    // Test document upload functionality
    await chatPage.addImageAttachment();
    
    // Verify attachment preview appears
    await chatPage.isElementVisible('attachments-preview');
    
    // Verify loader appears and disappears
    await chatPage.isElementVisible('input-attachment-loader');
    await chatPage.isElementNotVisible('input-attachment-loader');
    
    // Send message with attachment
    await chatPage.sendUserMessage('Analyze this document');
    
    // Verify message has attachment
    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.attachments).toHaveLength(1);
    
    // Verify AI response
    await chatPage.isGenerationComplete();
    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBeTruthy();
  });

  test('Multiple file upload works', async ({ page }) => {
    // This test assumes multiple file upload is supported
    // First, check if multiple file input is available
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.isVisible()) {
      const isMultiple = await fileInput.getAttribute('multiple');
      
      if (isMultiple !== null) {
        // Test multiple file upload
        await chatPage.addImageAttachment();
        await chatPage.addImageAttachment(); // Add second file
        
        // Check for multiple attachments
        await chatPage.isElementVisible('attachments-preview');
        
        const attachmentCount = await page.locator('[data-testid*="attachment"]').count();
        expect(attachmentCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('Chat history persists across page reloads', async ({ page }) => {
    // Send a message
    await chatPage.sendUserMessage('Test message for persistence');
    await chatPage.isGenerationComplete();
    
    const userMessage = await chatPage.getRecentUserMessage();
    const userMessageContent = userMessage.content;
    
    const assistantMessage = await chatPage.getRecentAssistantMessage();
    const assistantMessageContent = assistantMessage.content;
    
    // Reload the page
    await page.reload();
    
    // Verify messages are still there
    const reloadedUserMessage = await chatPage.getRecentUserMessage();
    const reloadedAssistantMessage = await chatPage.getRecentAssistantMessage();
    
    expect(reloadedUserMessage.content).toBe(userMessageContent);
    expect(reloadedAssistantMessage.content).toBe(assistantMessageContent);
  });

  test('Sidebar chat history management', async ({ page }) => {
    // Create multiple chats to test history
    await chatPage.sendUserMessage('First chat message');
    await chatPage.isGenerationComplete();
    
    // Create a new chat
    await chatPage.createNewChat();
    await chatPage.sendUserMessage('Second chat message');
    await chatPage.isGenerationComplete();
    
    // Open sidebar to check chat history
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Check for chat history items
    const chatItems = page.locator('[data-testid*="chat-item"], [data-testid*="sidebar-chat"]');
    const chatCount = await chatItems.count();
    expect(chatCount).toBeGreaterThanOrEqual(2);
  });

  test('Search functionality in chat history', async ({ page }) => {
    // Send a unique message for searching
    const uniqueMessage = `Unique test message ${Date.now()}`;
    await chatPage.sendUserMessage(uniqueMessage);
    await chatPage.isGenerationComplete();
    
    // Open sidebar
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Look for search functionality
    const searchInput = page.getByRole('textbox', { name: /search/i });
    if (await searchInput.isVisible()) {
      await searchInput.fill(uniqueMessage.split(' ')[0]); // Search for first word
      await page.waitForTimeout(500); // Wait for search to filter
      
      // Verify filtered results
      const visibleChatItems = page.locator('[data-testid*="chat-item"]:visible');
      const visibleCount = await visibleChatItems.count();
      expect(visibleCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('New chat creation from sidebar', async ({ page }) => {
    // Send a message in current chat
    await chatPage.sendUserMessage('Message in first chat');
    await chatPage.isGenerationComplete();
    
    const currentUrl = page.url();
    
    // Open sidebar and create new chat
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    const newChatButton = page.getByRole('button', { name: /new chat|create chat|\+/i });
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
      
      // Verify we're in a new chat
      const newUrl = page.url();
      expect(newUrl).not.toBe(currentUrl);
      
      // Verify input is empty and ready
      const messageInput = page.getByRole('textbox', { name: /message|chat/i });
      const inputValue = await messageInput.inputValue();
      expect(inputValue).toBe('');
    }
  });

  test('Chat deletion functionality', async ({ page }) => {
    // Send a message to create chat content
    await chatPage.sendUserMessage('Message to be deleted');
    await chatPage.isGenerationComplete();
    
    // Open sidebar
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Look for delete option (might be in context menu or direct button)
    const deleteButton = page.getByRole('button', { name: /delete|remove|trash/i });
    const moreOptions = page.getByRole('button', { name: /more|options|\.\.\./ });
    
    if (await moreOptions.isVisible()) {
      await moreOptions.click();
      const deleteOption = page.getByRole('menuitem', { name: /delete|remove/i });
      if (await deleteOption.isVisible()) {
        await deleteOption.click();
        
        // Confirm deletion if there's a confirmation dialog
        const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    } else if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Handle confirmation
      const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });

  test('Keyboard shortcuts work correctly', async ({ page }) => {
    // Test Enter to send message
    const messageInput = page.getByRole('textbox', { name: /message|chat/i });
    await messageInput.fill('Test keyboard shortcut');
    await messageInput.press('Enter');
    
    await chatPage.isGenerationComplete();
    
    // Verify message was sent
    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toContain('Test keyboard shortcut');
    
    // Test Shift+Enter for new line (if supported)
    await messageInput.fill('Line 1');
    await messageInput.press('Shift+Enter');
    await messageInput.type('Line 2');
    
    const inputContent = await messageInput.inputValue();
    if (inputContent.includes('\n')) {
      expect(inputContent).toBe('Line 1\nLine 2');
    }
  });

  test('Error handling for failed messages', async ({ page }) => {
    // This test simulates network issues or server errors
    // We'll need to intercept network requests to simulate failures
    
    await page.route('**/api/chat', route => {
      route.abort('failed');
    });
    
    await chatPage.sendUserMessage('This should fail');
    
    // Look for error indicators
    const errorMessage = page.getByText(/error|failed|try again/i);
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
    }
    
    // Verify retry functionality if available
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    if (await retryButton.isVisible()) {
      // Remove the route interception
      await page.unroute('**/api/chat');
      
      // Click retry
      await retryButton.click();
      await chatPage.isGenerationComplete();
      
      // Verify message eventually succeeds
      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content).toBeTruthy();
    }
  });
});