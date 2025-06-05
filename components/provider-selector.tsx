'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PROVIDERS } from '@/lib/ai/providers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Session } from 'next-auth';

// Declare global interface extensions at top level
declare global {
  interface Window {
    testProviderConfig: (provider?: string) => Promise<any>;
    testSwitchProvider: (provider?: string, preventReload?: boolean) => string;
    __testMode: boolean;
    providerDebug: {
      getCurrentProvider: () => string;
      switchProvider: (providerId: string) => void;
      clearProvider: () => void;
      getProviderConfig: () => Promise<any>;
      testModel: (modelId?: string) => Promise<any>;
      forceProvider: (provider?: string) => string;
    };
  }
}

const providers = [
  {
    id: PROVIDERS.OPENAI,
    name: 'OpenAI',
    icon: '🤖',
  },
];

interface ProviderSelectorProps {
  session: Session;
  selectedProviderId?: string;
  className?: string;
}

// Debug tools for testing provider configuration
if (typeof window !== 'undefined') {
  // Test provider configuration
  window.testProviderConfig = async (provider = 'openai') => {
    try {
      const response = await fetch('/api/check-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });

      const data = await response.json();
      console.log('Provider test result:', data);
      return data;
    } catch (error) {
      console.error('Provider test error:', error);
      return { error: 'Test failed' };
    }
  };

  // Test provider switching
  window.testSwitchProvider = (provider = 'openai', preventReload = true) => {
    try {
      // Call the selector component's provider switching function
      console.log(`Switching to provider: ${provider}`);
      if (preventReload) {
        // Set flag to prevent auto-reload during testing
        window.__testMode = true;
      }
      return `Test: switching to ${provider}`;
    } catch (error) {
      console.error('Switch test error:', error);
      return 'Switch test failed';
    }
  };
}

// Enhanced debugging for production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Add debugging helper for production environments
  window.providerDebug = {
    getCurrentProvider: () => {
      return localStorage.getItem('selectedProvider') || 'openai';
    },
    switchProvider: (providerId: string) => {
      localStorage.setItem('selectedProvider', providerId);
      window.location.reload();
    },
    clearProvider: () => {
      localStorage.removeItem('selectedProvider');
      window.location.reload();
    },
    getProviderConfig: async () => {
      try {
        const response = await fetch('/api/check-api-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ provider: 'openai' }),
        });
        return await response.json();
      } catch (error) {
        console.error('Provider config error:', error);
        return { error: 'Config check failed' };
      }
    },
    testModel: async (modelId = 'gpt-4o-mini') => {
      try {
        // Create a test message to verify the model works
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: 'test-chat',
            message: {
              id: 'test-message',
              role: 'user',
              content: 'Test message for model verification',
            },
            selectedChatModel: modelId,
            selectedProvider: 'openai',
          }),
        });

        if (!response.ok) {
          throw new Error(`Test failed with status: ${response.status}`);
        }

        console.log('Model test passed');
        return { success: true, model: modelId };
      } catch (error) {
        console.error('Model test error:', error);
        return { error: 'Model test failed', model: modelId };
      }
    },
    forceProvider: (provider = 'openai') => {
      // Force a specific provider without any checks
      localStorage.setItem('selectedProvider', provider);
      localStorage.setItem('providerForced', 'true');
      console.log(`Forced provider to: ${provider}`);
      return `Provider forced to: ${provider}`;
    },
  };
}

export function ProviderSelector({
  session,
  selectedProviderId,
  className,
}: ProviderSelectorProps) {
  const [currentProvider, setCurrentProvider] = useState(
    selectedProviderId || PROVIDERS.OPENAI,
  );
  const [isLoading, setIsLoading] = useState(false);

  // Initialize with OpenAI as the only provider
  useEffect(() => {
    const provider =
      localStorage.getItem('selectedProvider') || PROVIDERS.OPENAI;
    setCurrentProvider(provider);
  }, []);

  const selectedProvider = providers.find((p) => p.id === currentProvider);

  // Since OpenAI is the only provider, just show a non-interactive indicator
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm">{selectedProvider?.icon}</span>
      <span className="hidden md:inline text-sm font-medium">
        {selectedProvider?.name}
      </span>
      <Badge variant="secondary" className="text-xs">
        Active
      </Badge>
    </div>
  );
}
