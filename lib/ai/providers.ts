// Declare custom window property for TypeScript
declare global {
  interface Window {
    __previousProvider: string | null;
  }
}

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

const PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
} as const;

export { PROVIDERS };

// Create a chat model with the specified provider
export function createChatModel(
  selectedChatModel: string,
  selectedProvider: string = PROVIDERS.ANTHROPIC,
) {
  // Check if it's a Claude model
  if (selectedChatModel.startsWith('claude-')) {
    const chatModel = anthropic(selectedChatModel);
    console.log(`Using Anthropic provider with model: ${selectedChatModel}`);
    return chatModel;
  }
  // Fall back to OpenAI for non-Claude models
  const chatModel = openai(selectedChatModel);
  console.log(`Using OpenAI provider with model: ${selectedChatModel}`);
  return chatModel;
}

// Export the default provider - now Anthropic
export const DEFAULT_PROVIDER = PROVIDERS.ANTHROPIC;
export const myProvider = anthropic;

// Helper function to validate provider availability (validate once per process)
let providerValidated = false;
export function validateProviderConfig(provider: string) {
  if (providerValidated) return true;

  console.log(`Validating provider configuration...`);
  
  // Validate Anthropic API key (primary)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not found in environment');
    throw new Error('Anthropic API key is required');
  }
  console.log('Anthropic provider configuration validated');
  
  // Also validate OpenAI for image generation
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not found - image generation will be unavailable');
  }
  
  providerValidated = true;
  return true;
}

// Model configuration (memoized to avoid rebuilding models per request)
// Using Claude 4.5 Sonnet as the primary model
let memoizedModelConfig: Record<string, ReturnType<typeof anthropic> | ReturnType<typeof openai>> | null =
  null;
const getModelConfig = () => {
  try {
    console.log('Using Anthropic Claude models');
    if (memoizedModelConfig) return memoizedModelConfig;

    memoizedModelConfig = {
      // Primary chat model - Claude 4.5 Sonnet
      'chat-model': anthropic('claude-sonnet-4-5-20250929'),
      // Title generation - Claude 4.5 Haiku (fast and cheap)
      'title-model': anthropic('claude-haiku-4-5-20251001'),
      // Composer/document generation - Claude 4.5 Sonnet
      'composer-model': anthropic('claude-sonnet-4-5-20250929'),
      // Preflight model selection - Claude 4.5 Haiku
      'preflight-model': anthropic('claude-haiku-4-5-20251001'),
      // Image generation - keep OpenAI
      'small-model': openai('gpt-image-1'),
      // Claude 4.5 Sonnet - used for all chat queries
      // Extended thinking is enabled via experimental_providerMetadata, not a separate model
      'claude-sonnet': anthropic('claude-sonnet-4-5-20250929'),
    };
    return memoizedModelConfig;
  } catch (error) {
    console.error('Error creating provider models:', error);
    throw error;
  }
};

export const createCustomProvider = (
  selectedProvider: string = PROVIDERS.ANTHROPIC,
) => {
  console.log(`Creating provider: ${selectedProvider}`);

  try {
    validateProviderConfig(selectedProvider);
    const modelConfig = getModelConfig();

    return {
      languageModel: (modelId: string) => {
        // First check if it's in the predefined config
        const model = modelConfig[modelId as keyof typeof modelConfig];
        if (model) {
          return model;
        }

        // If not in config, create the model dynamically based on model ID
        console.log(`Creating dynamic model: ${modelId}`);
        
        // Claude models
        if (modelId.startsWith('claude-')) {
          return anthropic(modelId);
        }
        
        // OpenAI models (gpt-*, o1-*, o3-*, o4-*, etc.)
        return openai(modelId);
      },
    };
  } catch (error) {
    console.error(`Error creating provider ${selectedProvider}:`, error);
    throw error;
  }
};
