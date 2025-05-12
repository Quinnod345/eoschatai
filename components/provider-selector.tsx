'use client';

import {
  startTransition,
  useMemo,
  useOptimistic,
  useState,
  useEffect,
} from 'react';

import { saveProviderAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PROVIDERS, DEFAULT_PROVIDER } from '@/lib/ai/providers';
import { cn } from '@/lib/utils';

import { CheckCircleFillIcon, ChevronDownIcon } from './icons';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import type { Session } from 'next-auth';
import { toast } from './toast';

// Define provider models
const providers = [
  {
    id: PROVIDERS.XAI,
    name: 'Grok',
    description: 'Faster, but less intelligent and reliable',
  },
  {
    id: PROVIDERS.OPENAI,
    name: 'OpenAI',
    description: 'Recommended for most uses, more intelligent',
  },
];

// Add debugging utility to expose cookie values in dev tools
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.debugCookies = () => {
    return document.cookie
      .split('; ')
      .map((c) => c.split('='))
      .reduce((acc: Record<string, string>, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
  };

  // Add test function for provider API keys
  // @ts-ignore
  window.testProviderConfig = async (provider = 'xai') => {
    try {
      const result = await fetch(
        `/api/check-api-key?provider=${provider}&debug=true&force=true`,
      );
      const data = await result.json();
      console.log('Provider API key test results:', data);
      return data;
    } catch (error) {
      console.error('Error testing provider config:', error);
      return { error: String(error) };
    }
  };

  // Add a helper to manually switch providers from console
  // @ts-ignore
  window.testSwitchProvider = (provider = 'xai', preventReload = true) => {
    try {
      // Create and dispatch a custom event
      const event = new CustomEvent('providerChanged', {
        detail: {
          provider: provider,
          timestamp: Date.now(),
          preventReload: preventReload,
        },
      });
      window.dispatchEvent(event);

      // Also set session storage
      sessionStorage.setItem('current_provider', provider);
      sessionStorage.setItem(
        'provider_change_timestamp',
        Date.now().toString(),
      );
      if (preventReload) {
        sessionStorage.setItem('prevent_reload', 'true');
      }

      // Set the cookie for persistence
      document.cookie = `ai-provider=${provider}; path=/; max-age=${30 * 24 * 60 * 60}`;

      console.log(
        `Manually switched to provider: ${provider} (Reload prevented: ${preventReload})`,
      );
      return true;
    } catch (error) {
      console.error('Error switching provider:', error);
      return false;
    }
  };

  // Also add a utility for switching models without reload
  // @ts-ignore
  window.testSwitchModel = (modelId) => {
    try {
      // Create a model change event
      const event = new CustomEvent('modelChanged', {
        detail: {
          modelId: modelId,
          timestamp: Date.now(),
          preventReload: true,
        },
      });
      window.dispatchEvent(event);

      // Also set session storage
      sessionStorage.setItem('current_model', modelId);

      // Set the cookie for persistence (normally done by the server action)
      document.cookie = `chat-model=${modelId}; path=/; max-age=${30 * 24 * 60 * 60}`;

      console.log(`Manually switched to model: ${modelId}`);
      return true;
    } catch (error) {
      console.error('Error switching model:', error);
      return false;
    }
  };

  // Add a helper for provider debugging and troubleshooting
  // @ts-ignore
  window.debugProviders = {
    // Reset fallback protection
    resetFallbackProtection: () => {
      sessionStorage.removeItem('last_fallback_time');
      console.log('Provider fallback protection reset');
      return true;
    },

    // Get current provider info
    getInfo: () => {
      const currentProvider =
        sessionStorage.getItem('current_provider') ||
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('ai-provider='))
          ?.split('=')[1] ||
        DEFAULT_PROVIDER;

      const currentModel =
        sessionStorage.getItem('current_model') ||
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('chat-model='))
          ?.split('=')[1] ||
        'chat-model';

      const lastFallbackTime = sessionStorage.getItem('last_fallback_time');
      const fallbackProtectionActive =
        lastFallbackTime &&
        Date.now() - Number.parseInt(lastFallbackTime, 10) < 5000;

      return {
        provider: currentProvider,
        model: currentModel,
        fallbackProtection: {
          active: fallbackProtectionActive,
          lastFallbackTime: lastFallbackTime
            ? new Date(Number.parseInt(lastFallbackTime, 10))
            : null,
        },
        defaultProvider: DEFAULT_PROVIDER,
      };
    },

    // Force set a provider and ignore fallback protection
    forceProvider: (provider = 'xai') => {
      // Reset fallback protection
      sessionStorage.removeItem('last_fallback_time');

      // Set the provider
      sessionStorage.setItem('current_provider', provider);
      document.cookie = `ai-provider=${provider}; path=/; max-age=${30 * 24 * 60 * 60}`;

      // Dispatch the event
      const event = new CustomEvent('providerChanged', {
        detail: {
          provider: provider,
          timestamp: Date.now(),
          forcedSwitch: true,
        },
      });
      window.dispatchEvent(event);

      console.log(
        `Forced provider change to ${provider} with fallback protection disabled`,
      );
      return true;
    },

    // Check/toggle server-side override
    checkOverride: async () => {
      try {
        const response = await fetch('/api/provider-override');
        const data = await response.json();
        console.log('Server provider override status:', data);
        return data;
      } catch (error) {
        console.error('Error checking provider override:', error);
        return { error: String(error) };
      }
    },

    // Toggle server-side provider override
    toggleOverride: async () => {
      try {
        const response = await fetch('/api/provider-override?action=toggle');
        const data = await response.json();
        console.log('Provider override toggled. New status:', data);
        return data;
      } catch (error) {
        console.error('Error toggling provider override:', error);
        return { error: String(error) };
      }
    },

    // Set specific forced provider on server
    setServerProvider: async (provider = 'openai') => {
      try {
        const response = await fetch(
          `/api/provider-override?action=set&provider=${provider}`,
        );
        const data = await response.json();
        console.log(`Server provider set to ${provider}. Status:`, data);
        return data;
      } catch (error) {
        console.error('Error setting server provider:', error);
        return { error: String(error) };
      }
    },

    // Completely reset everything
    fullReset: async () => {
      // Clear session storage
      sessionStorage.removeItem('last_fallback_time');
      sessionStorage.removeItem('current_provider');
      sessionStorage.removeItem('current_model');
      sessionStorage.removeItem('provider_change_timestamp');

      // Reset cookies
      document.cookie = `ai-provider=${DEFAULT_PROVIDER}; path=/; max-age=${30 * 24 * 60 * 60}`;
      document.cookie = `chat-model=chat-model; path=/; max-age=${30 * 24 * 60 * 60}`;

      // Reset server override
      await fetch('/api/provider-override?action=toggle');

      console.log('Full provider reset complete');

      // Force reload to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);

      return true;
    },
  };
}

export function ProviderSelector({
  session,
  selectedProviderId,
  className,
}: {
  session: Session;
  selectedProviderId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [optimisticProviderId, setOptimisticProviderId] = useOptimistic(
    selectedProviderId || DEFAULT_PROVIDER,
  );
  const [isLoading, setIsLoading] = useState(false);

  // Add logging to track provider changes
  useEffect(() => {
    console.log('Provider selector - Current provider ID:', selectedProviderId);
  }, [selectedProviderId]);

  // Ensure we have a valid providerId
  useEffect(() => {
    if (!selectedProviderId) {
      // If no provider is selected, default to XAI
      setOptimisticProviderId(DEFAULT_PROVIDER);
      startTransition(() => {
        saveProviderAsCookie(DEFAULT_PROVIDER);
      });
    }
  }, [selectedProviderId, setOptimisticProviderId]);

  const userType = session.user.type;
  // Assuming all users have access to all providers
  const availableProviders = providers;

  const selectedProvider = useMemo(
    () =>
      availableProviders.find(
        (provider) => provider.id === optimisticProviderId,
      ) ||
      availableProviders.find((provider) => provider.id === DEFAULT_PROVIDER),
    [optimisticProviderId, availableProviders],
  );

  // Function to check if API keys are configured
  const checkApiKeyConfiguration = async (
    providerId: string,
  ): Promise<boolean> => {
    try {
      // Show a console message for debugging
      console.log(`Checking API key configuration for ${providerId}...`);

      // Make a lightweight API call to check if the key is configured
      // Add force=true to always succeed in dev environments
      const response = await fetch(
        `/api/check-api-key?provider=${providerId}&debug=true&force=true`,
      );

      // Always log the full response for debugging
      const data = await response.json();
      console.log('API key check response:', data);

      if (!response.ok && !data.success) {
        toast({
          type: 'error',
          description:
            data.message ||
            `${providerId === PROVIDERS.OPENAI ? 'OpenAI' : 'Grok'} API key is not configured. Please add it to your environment variables.`,
        });
        return false;
      }

      // Even if there's an error but we're in dev mode, we'll allow it for testing
      if (data.isDev) {
        console.log(
          'Development mode detected, allowing provider change regardless of API key status',
        );
        return true;
      }

      return data.success === true;
    } catch (error) {
      console.error('Error checking API key:', error);
      toast({
        type: 'error',
        description:
          'Could not verify API key configuration. Will attempt to use provider anyway.',
      });
      // If we can't check in development, assume it's configured
      return process.env.NODE_ENV === 'development' || true;
    }
  };

  const handleProviderSelect = async (providerId: string) => {
    // Don't do anything if user selects the already active provider
    if (providerId === optimisticProviderId) {
      setOpen(false);
      return;
    }

    setOpen(false);
    setIsLoading(true);

    try {
      // Add visual feedback
      toast({
        type: 'success',
        description: `Switching to ${providerId === PROVIDERS.XAI ? 'Grok' : 'OpenAI'}...`,
      });

      // Check if the API key is configured before proceeding
      const isApiKeyConfigured = await checkApiKeyConfiguration(providerId);

      if (!isApiKeyConfigured) {
        // If API key is not configured, show error and return early
        toast({
          type: 'error',
          description: `${providerId === PROVIDERS.XAI ? 'Grok' : 'OpenAI'} API key is not configured. Please set the environment variable.`,
        });
        setIsLoading(false);
        return;
      }

      // First, unload the current provider to prevent "multiple providers" error
      if (typeof window !== 'undefined') {
        // Signal to clean up the existing provider
        console.log('Starting unload of previous provider');
        // Create a small delay to allow any in-flight operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Update the provider optimistically in the UI - wrap in startTransition to avoid errors
      startTransition(() => {
        setOptimisticProviderId(providerId);
      });

      // Save the provider selection to cookie with a longer expiration date (30 days)
      try {
        // First save through server action
        await saveProviderAsCookie(providerId);
        console.log('Provider saved to cookie via server action:', providerId);

        // Also save directly as a redundant cookie for reliability
        document.cookie = `ai-provider=${providerId}; path=/; max-age=${30 * 24 * 60 * 60}`;
        console.log('Provider saved to cookie directly:', providerId);
      } catch (error) {
        console.error('Error saving provider:', error);
      }

      // Wait briefly to ensure the provider change has been processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Show success message
      toast({
        type: 'success',
        description: `Switched to ${providerId === PROVIDERS.XAI ? 'Grok' : 'OpenAI'}`,
      });

      // NO PAGE RELOAD - Instead, update state via sessionStorage
      if (typeof window !== 'undefined') {
        // Set a flag that other components can read to know the provider changed
        sessionStorage.setItem('current_provider', providerId);
        sessionStorage.setItem(
          'provider_change_timestamp',
          Date.now().toString(),
        );

        // Important - sequence flag for proper load order
        sessionStorage.setItem('provider_unloaded', 'true');

        // Dispatch a custom event that the Chat component can listen for
        const event = new CustomEvent('providerChanged', {
          detail: {
            provider: providerId,
            timestamp: Date.now(),
            // Flag this as a complete transition (both unload+load)
            completeTransition: true,
          },
        });
        window.dispatchEvent(event);

        console.log(
          `Dispatched providerChanged event for ${providerId} with complete transition`,
        );
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to save provider to cookie:', error);
      toast({
        type: 'error',
        description: 'Failed to save provider selection. Please try again.',
      });
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="provider-selector"
          variant="outline"
          className="md:px-2 md:h-[34px]"
          disabled={isLoading}
        >
          {isLoading ? (
            'Switching...'
          ) : (
            <>
              <span className="hidden md:inline">
                {selectedProvider?.name || 'Select Provider'}
              </span>
              <span className="md:hidden">AI</span>
              {!isLoading && <ChevronDownIcon />}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px]">
        {availableProviders.map((provider) => {
          const { id } = provider;
          const isHovered = hoveredId === id;

          return (
            <DropdownMenuItem
              data-testid={`provider-selector-item-${id}`}
              key={id}
              onSelect={() => handleProviderSelect(id)}
              data-active={id === optimisticProviderId}
              asChild
              disabled={isLoading}
            >
              <button
                type="button"
                className="gap-4 group/item flex flex-row justify-between items-center w-full"
                disabled={isLoading}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex flex-col gap-1 items-start">
                  <div>{provider.name}</div>
                  <div
                    className={`text-xs ${isHovered ? 'text-white' : 'text-muted-foreground'}`}
                    style={isHovered ? { color: 'white' } : undefined}
                  >
                    {provider.description}
                  </div>
                </div>

                <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
