import { expect, test } from '../fixtures';
import { ChatPage } from '../pages/chat';
import { ComposerPage } from '../pages/composer';

test.describe('Composer activity', () => {
  let chatPage: ChatPage;
  let composerPage: ComposerPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    composerPage = new ComposerPage(page);

    await chatPage.createNewChat();
  });

  test('Create a text composer', async () => {
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      'Help me write an essay about Silicon Valley',
    );
    await composerPage.isGenerationComplete();

    expect(composerPage.composer).toBeVisible();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain(
      "I've created a document titled",
    );
    expect(assistantMessage.content).toContain('for you in the right panel');

    await chatPage.hasChatIdInUrl();
  });

  test('Toggle composer visibility', async () => {
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      'Help me write an essay about Silicon Valley',
    );
    await composerPage.isGenerationComplete();

    expect(composerPage.composer).toBeVisible();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain(
      "I've created a document titled",
    );
    expect(assistantMessage.content).toContain('for you in the right panel');

    await composerPage.closeComposer();
    await chatPage.isElementNotVisible('composer');
  });

  test('Send follow up message after generation', async () => {
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      'Help me write an essay about Silicon Valley',
    );
    await composerPage.isGenerationComplete();

    expect(composerPage.composer).toBeVisible();

    const assistantMessage = await composerPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain(
      "I've created a document titled",
    );
    expect(assistantMessage.content).toContain('for you in the right panel');

    await composerPage.sendUserMessage('Thanks!');
    await composerPage.isGenerationComplete();

    const secondAssistantMessage = await chatPage.getRecentAssistantMessage();
    expect(secondAssistantMessage.content).toBe("You're welcome!");
  });
});
