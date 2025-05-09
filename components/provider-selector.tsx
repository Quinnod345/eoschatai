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
    description: 'Reccomended for most uses',
  },
  {
    id: PROVIDERS.OPENAI,
    name: 'OpenAI',
    description: 'More intelligent, but experimental',
  },
];

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
      // Make a lightweight API call to check if the key is configured
      const response = await fetch(`/api/check-api-key?provider=${providerId}`);

      if (!response.ok) {
        const data = await response.json();
        toast({
          type: 'error',
          description:
            data.message ||
            `${providerId === PROVIDERS.OPENAI ? 'OpenAI' : 'Grok'} API key is not configured. Please add it to your environment variables.`,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking API key:', error);
      // If we can't check, assume it's configured and let the actual API call fail if needed
      return true;
    }
  };

  const handleProviderSelect = async (providerId: string) => {
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
        return;
      }

      // Update the provider optimistically in the UI
      setOptimisticProviderId(providerId);

      // Save the provider selection to cookie
      await saveProviderAsCookie(providerId);
      console.log('Provider saved to cookie:', providerId);

      // Show success message
      toast({
        type: 'success',
        description: `Switched to ${providerId === PROVIDERS.XAI ? 'Grok' : 'OpenAI'}`,
      });

      // Add a small delay to ensure cookie is saved before reload
      setTimeout(() => {
        // Set a timestamp so Chat component knows we're doing a provider-initiated reload
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            'provider_change_timestamp',
            Date.now().toString(),
          );
        }

        // Force a page reload to ensure the new provider is used
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to save provider to cookie:', error);
      toast({
        type: 'error',
        description: 'Failed to save provider selection. Please try again.',
      });
    } finally {
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
