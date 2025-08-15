import { expect, type Page } from '@playwright/test';

export class ComposerPage {
  constructor(private page: Page) {}

  public get composer() {
    return this.page.getByTestId('composer');
  }

  public get sendButton() {
    return this.composer.getByTestId('send-button');
  }

  public get stopButton() {
    return this.page.getByTestId('stop-button');
  }

  public get multimodalInput() {
    return this.page.getByTestId('multimodal-input');
  }

  async isGenerationComplete() {
    const response = await this.page.waitForResponse((response) =>
      response.url().includes('/api/chat'),
    );

    await response.finished();
  }

  async sendUserMessage(message: string) {
    await this.composer.getByTestId('multimodal-input').click();
    await this.composer.getByTestId('multimodal-input').fill(message);
    await this.composer.getByTestId('send-button').click();
  }

  async getRecentAssistantMessage() {
    const messageElements = await this.composer
      .getByTestId('message-assistant')
      .all();
    const lastMessageElement = messageElements[messageElements.length - 1];

    const content = await lastMessageElement
      .getByTestId('message-content')
      .innerText()
      .catch(() => null);

    return {
      element: lastMessageElement,
      content,
    };
  }

  async getRecentUserMessage() {
    const messageElements = await this.composer
      .getByTestId('message-user')
      .all();
    const lastMessageElement = messageElements[messageElements.length - 1];

    const content = await lastMessageElement.innerText();

    const hasAttachments = await lastMessageElement
      .getByTestId('message-attachments')
      .isVisible()
      .catch(() => false);

    const attachments = hasAttachments
      ? await lastMessageElement.getByTestId('message-attachments').all()
      : [];

    const page = this.composer;

    return {
      element: lastMessageElement,
      content,
      attachments,
      async edit(newMessage: string) {
        await page.getByTestId('message-edit-button').click();
        await page.getByTestId('message-editor').fill(newMessage);
        await page.getByTestId('message-editor-send-button').click();
        await expect(
          page.getByTestId('message-editor-send-button'),
        ).not.toBeVisible();
      },
    };
  }

  async closeComposer() {
    return this.page.getByTestId('composer-close-button').click();
  }
}
