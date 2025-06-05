// Declare custom window property for TypeScript
declare global {
  interface Window {
    __previousProvider: string | null;
  }
}

import { openai } from '@ai-sdk/openai';

const PROVIDERS = {
  OPENAI: 'openai',
} as const;

export { PROVIDERS };

// Create a chat model with the specified provider
export function createChatModel(
  selectedChatModel: string,
  selectedProvider: string = PROVIDERS.OPENAI,
) {
  const chatModel = openai(selectedChatModel);
  console.log(`Using OpenAI provider with model: ${selectedChatModel}`);
  return chatModel;
}

// Export the default provider - now just OpenAI
export const DEFAULT_PROVIDER = PROVIDERS.OPENAI;
export const myProvider = openai;

// Helper function to validate provider availability
export function validateProviderConfig(provider: string) {
  console.log(`Validating OpenAI provider configuration...`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found in environment');
    throw new Error('OpenAI API key is required');
  }

  console.log('OpenAI provider configuration validated');
  return true;
}

// Model configuration for OpenAI
const getModelConfig = () => {
  try {
    console.log('Using OpenAI provider models');

    return {
      'chat-model': openai('gpt-4o-mini'),
      'title-model': openai('gpt-4o-mini'),
      'artifact-model': openai('gpt-4o-mini'),
      'small-model': openai('dall-e-3'),
    };
  } catch (error) {
    console.error('Error creating OpenAI provider:', error);
    throw error;
  }
};

export const createCustomProvider = (
  selectedProvider: string = PROVIDERS.OPENAI,
) => {
  console.log(`Creating provider: ${selectedProvider}`);

  try {
    validateProviderConfig(selectedProvider);
    const modelConfig = getModelConfig();

    return {
      languageModel: (modelId: string) => {
        const model = modelConfig[modelId as keyof typeof modelConfig];
        if (!model) {
          console.warn(
            `Model ${modelId} not found, falling back to chat-model`,
          );
          return modelConfig['chat-model'];
        }
        return model;
      },
    };
  } catch (error) {
    console.error(`Error creating provider ${selectedProvider}:`, error);
    throw error;
  }
};
