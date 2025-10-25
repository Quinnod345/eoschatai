'use client';

import { useState, useEffect } from 'react';
import { useAccountStore } from '@/lib/stores/account-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OrganizationModal } from '@/components/organization-modal';
import { Loader2, Building2, AlertCircle, CheckCircle } from 'lucide-react';

interface BusinessUpgradeFlowProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type FlowStep =
  | 'checking'
  | 'needs-org'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error';

export function BusinessUpgradeFlow({
  open,
  onClose,
  onSuccess,
}: BusinessUpgradeFlowProps) {
  const { org, user } = useAccountStore();
  const [step, setStep] = useState<FlowStep>('checking');
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  console.log('[BusinessUpgradeFlow] Component rendered:', {
    open,
    step,
    org,
    showOrgModal,
  });

  // Check organization status when modal opens
  useEffect(() => {
    console.log('[BusinessUpgradeFlow] Open changed:', open);
    if (open) {
      checkOrganizationStatus();
    }
  }, [open]);

  const checkOrganizationStatus = async () => {
    setStep('checking');
    setError(null);

    // Small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (org) {
      setStep('ready');
    } else {
      setStep('needs-org');
    }
  };

  const handleOrgCreated = async (orgId: string) => {
    setShowOrgModal(false);
    setStep('checking');

    // Refresh account data
    const refreshEvent = new Event('account-refresh');
    window.dispatchEvent(refreshEvent);

    // Wait for refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check again
    checkOrganizationStatus();
  };

  const proceedToCheckout = async () => {
    if (!org) {
      setError('Organization not found. Please try again.');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'business',
          billing: 'monthly',
          orgId: org.id,
          seats: 2, // Default to 2 seats for business
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        setCheckoutUrl(url);
        setStep('success');

        // Redirect after a short delay
        setTimeout(() => {
          window.location.href = url;
        }, 1500);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to start checkout',
      );
      setStep('error');
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'checking':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Checking organization status...
            </p>
          </div>
        );

      case 'needs-org':
        return (
          <div className="space-y-4">
            <Alert>
              <Building2 className="h-4 w-4" />
              <AlertDescription>
                Business subscriptions require an organization for team
                collaboration and billing.
              </AlertDescription>
            </Alert>

            <div className="text-center">
              <h3 className="font-semibold mb-2">Set Up Your Organization</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create or join an organization to continue with your Business
                upgrade.
              </p>
              <Button onClick={() => setShowOrgModal(true)}>
                <Building2 className="w-4 h-4 mr-2" />
                Set Up Organization
              </Button>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Organization Details</h4>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Name:</span>{' '}
                {org?.name || 'Unknown'}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Current Plan:</span>{' '}
                {org?.plan || 'free'}
              </p>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your organization is ready for Business upgrade! Click continue
                to proceed to checkout.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border p-4">
              <h4 className="font-semibold mb-2">Business Plan Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Everything in Pro plan</li>
                <li>• Deep research with 40 web lookups</li>
                <li>• Team collaboration features</li>
                <li>• Priority support</li>
                <li>• Starting at 2 seats (expandable)</li>
              </ul>
              <p className="text-sm font-semibold mt-3">
                $99/month for 2 seats
              </p>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Creating checkout session...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Success!</h3>
            <p className="text-sm text-muted-foreground">
              Redirecting to Stripe checkout...
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'An error occurred'}
              </AlertDescription>
            </Alert>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Please try again or contact support if the issue persists.
              </p>
              <Button onClick={() => setStep('ready')} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <Dialog open={open && !showOrgModal} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg" forceMount>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Upgrade to Business
            </DialogTitle>
            <DialogDescription>
              {step === 'checking' && 'Preparing your Business upgrade...'}
              {step === 'needs-org' && 'Organization setup required'}
              {step === 'ready' && 'Complete your Business subscription'}
              {step === 'processing' && 'Processing your upgrade...'}
              {step === 'success' && 'Upgrade successful!'}
              {step === 'error' && 'Something went wrong'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">{renderContent()}</div>

          <DialogFooter>
            {step !== 'success' && step !== 'processing' && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            {step === 'ready' && (
              <Button onClick={proceedToCheckout}>Continue to Checkout</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrganizationModal
        open={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        onContinue={handleOrgCreated}
        isUpgradeFlow={true}
      />
    </>
  );
}
