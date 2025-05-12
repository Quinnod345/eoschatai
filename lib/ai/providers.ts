// Declare custom window property for TypeScript
declare global {
  interface Window {
    __previousProvider: string | null;
  }
}

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

// Set default provider to OpenAI for better RAG tool support
export const DEFAULT_PROVIDER = PROVIDERS.OPENAI;

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
export const createCustomProvider = (providerNameInput: string) => {
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

  try {
    // Log provider choice for debugging
    console.log(`Creating provider for: ${providerNameInput}`);

    // Add a cleanup mechanism for any previous providers if they exist
    if (typeof window !== 'undefined' && window.__previousProvider) {
      console.log('Cleaning up previous provider before creating new one');
      try {
        // Set the previous provider to null to help garbage collection
        window.__previousProvider = null;
      } catch (err) {
        console.warn('Error cleaning up previous provider:', err);
      }
    }

    // Check the override setting from server-side
    let providerToUse = providerNameInput;

    // Validate provider name is valid
    if (providerToUse !== PROVIDERS.OPENAI && providerToUse !== PROVIDERS.XAI) {
      console.warn(
        `Unknown provider: ${providerNameInput}, falling back to ${DEFAULT_PROVIDER}`,
      );
      providerToUse = DEFAULT_PROVIDER;
    }

    const providerFactory = getProviderFactory(providerToUse);

    // Check if the necessary environment variables are set
    if (providerToUse === PROVIDERS.XAI && !process.env.XAI_API_KEY) {
      console.warn(
        'XAI_API_KEY not found in environment, falling back to OpenAI',
      );
      providerToUse = PROVIDERS.OPENAI;
    }

    // Only show error if we're in production; in development, use a fake key if needed
    if (providerToUse === PROVIDERS.OPENAI && !process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        console.error(
          'OPENAI_API_KEY not found in environment - API calls will fail',
        );
      } else {
        console.warn(
          'OPENAI_API_KEY not found, but in development mode so continuing with limited functionality',
        );
        // In development, we'll still try to make it work with mock responses
      }
    }

    // Store reference to created provider for cleanup
    if (typeof window !== 'undefined') {
      window.__previousProvider = providerToUse;
    }

    // Create and return the provider
    if (providerToUse === PROVIDERS.OPENAI) {
      return customProvider({
        languageModels: {
          'chat-model': openai('gpt-4.1'), // OpenAI models fully support RAG tools
          'chat-model-reasoning': openai('o4-mini'),
          'title-model': openai('gpt-4.1-nano'),
          'artifact-model': openai('gpt-4.1'),
        },
        imageModels: {
          'small-model': openai.image('dall-e-3'),
        },
      });
    } else {
      // XAI (Grok) provider - we need to ensure these models can handle tools properly
      // Grok may have limited support for function/tool calling
      console.log(
        'Using XAI (Grok) provider - RAG tool support may be limited',
      );

      try {
        // Wrap in try-catch to handle any initialization errors with Grok
        return customProvider({
          languageModels: {
            'chat-model': xai('grok-2-vision'), // May have limited tools support
            'chat-model-reasoning': wrapLanguageModel({
              model: xai('grok-3-mini-beta'),
              middleware: extractReasoningMiddleware({
                tagName: 'think',
                startWithReasoning: true,
                separator: '\n\n===== FINAL ANSWER =====\n\n', // More distinctive separator
              }),
            }),
            'title-model': xai('grok-2-1212'),
            'artifact-model': xai('grok-2-1212'),
          },
          imageModels: {
            'small-model': xai.image('grok-2-image'),
          },
        });
      } catch (error) {
        console.error(
          'Error creating XAI provider, falling back to OpenAI:',
          error,
        );
        // Fall back to OpenAI in case of errors with XAI
        return customProvider({
          languageModels: {
            'chat-model': openai('gpt-4.1'),
            'chat-model-reasoning': openai('o4-mini'),
            'title-model': openai('gpt-4.1-nano'),
            'artifact-model': openai('gpt-4.1'),
          },
          imageModels: {
            'small-model': openai.image('dall-e-3'),
          },
        });
      }
    }
  } catch (error) {
    console.error('Error creating provider, using fallback:', error);
    // Ultimate fallback in case of any errors
    return customProvider({
      languageModels: {
        'chat-model': openai('gpt-4.1'),
        'chat-model-reasoning': openai('o4-mini'),
        'title-model': openai('gpt-4.1-nano'),
        'artifact-model': openai('gpt-4.1'),
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
  }
};

// The actual provider to use (default)
export const myProvider = createCustomProvider(DEFAULT_PROVIDER);
