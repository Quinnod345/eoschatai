import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { openai } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';

// Default provider
export const PROVIDERS = {
  XAI: 'xai',
  OPENAI: 'openai',
};

export const DEFAULT_PROVIDER = PROVIDERS.XAI;

// Get the provider factory based on provider name
export const getProviderFactory = (providerName: string) => {
  switch (providerName) {
    case PROVIDERS.OPENAI:
      return openai;
    case PROVIDERS.XAI:
    default:
      return xai;
  }
};

// Create customized provider with models for each provider
export const createCustomProvider = (providerName: string) => {
  // In test environments, return a simple provider with no dependencies on test modules
  if (isTestEnvironment) {
    return customProvider({
      languageModels: {
        'chat-model': openai('gpt-4o'), // Use same models as production but they'll be mocked in tests
        'chat-model-reasoning': openai('o4-mini'),
        'title-model': openai('gpt-4o-mini'),
        'artifact-model': openai('gpt-4o-mini'),
      },
    });
  }

  const providerFactory = getProviderFactory(providerName);

  if (providerName === PROVIDERS.OPENAI) {
    return customProvider({
      languageModels: {
        'chat-model': openai('gpt-4o'),
        'chat-model-reasoning': openai('o4-mini'),
        'title-model': openai('gpt-4o-mini'),
        'artifact-model': openai('gpt-4o-mini'),
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
  } else {
    // XAI (Grok) provider
    return customProvider({
      languageModels: {
        'chat-model': xai('grok-2-vision-1212'),
        'chat-model-reasoning': wrapLanguageModel({
          model: xai('grok-3-mini-beta'),
          middleware: extractReasoningMiddleware({
            tagName: 'think',
            startWithReasoning: true,
          }),
        }),
        'title-model': xai('grok-2-1212'),
        'artifact-model': xai('grok-2-1212'),
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
  }
};

// The actual provider to use (default)
export const myProvider = createCustomProvider(DEFAULT_PROVIDER);
