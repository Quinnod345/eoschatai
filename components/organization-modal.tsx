'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Shield, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAccountStore } from '@/lib/stores/account-store';

interface OrganizationModalProps {
  open: boolean;
  onClose: () => void;
  onContinue: (orgId: string) => void;
  /**
   * If true, this is part of a business upgrade flow.
   * If false, this is standalone org creation and should prompt for upgrade.
   */
  isUpgradeFlow?: boolean;
}

export function OrganizationModal({
  open,
  onClose,
  onContinue,
  isUpgradeFlow = false,
}: OrganizationModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [organizationName, setOrganizationName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingOrg, setExistingOrg] = useState<any>(null);
  const user = useAccountStore((state) => state.user);

  // Check if user already has an organization when modal opens
  useEffect(() => {
    if (!open) return;

    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchUserSettings = async () => {
      try {
        const response = await fetch('/api/user-settings', { signal });
        if (response.ok && !signal.aborted) {
          const data = await response.json();
          // Only seed the input if it's currently empty.
          if (data.companyName) {
            setOrganizationName((current) => current || data.companyName);
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to fetch user settings:', error);
        }
      }
    };

    const checkExistingOrganization = async () => {
      setCheckingExisting(true);
      setError(null);

      try {
        const response = await fetch('/api/organizations', { signal });
        if (response.ok && !signal.aborted) {
          const data = await response.json();
          if (data.organization) {
            setExistingOrg(data.organization);
          } else {
            setExistingOrg(null);
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to check existing organization:', error);
        }
      } finally {
        if (!signal.aborted) {
          setCheckingExisting(false);
        }
      }
    };

    checkExistingOrganization();
    fetchUserSettings();

    return () => {
      abortController.abort();
    };
  }, [open]);

  const checkExistingOrganizationAction = async () => {
    setCheckingExisting(true);
    setError(null);

    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        if (data.organization) {
          setExistingOrg(data.organization);
        } else {
          setExistingOrg(null);
        }
      }
    } catch (error) {
      console.error('Error checking organization:', error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!organizationName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: organizationName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create organization');
      }

      const { organization } = await response.json();
      onContinue(organization.id);
    } catch (error: any) {
      // If user already has an org, that's actually okay - check if we can proceed
      if (error?.message?.includes('already belong to an organization')) {
        // Fetch the existing org
        try {
          const checkResponse = await fetch('/api/organizations');
          if (checkResponse.ok) {
            const data = await checkResponse.json();
            if (data.organization) {
              onContinue(data.organization.id);
              return;
            }
          }
        } catch (checkError) {
          console.error('Failed to check existing org:', checkError);
        }
      }

      setError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/organizations/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join organization');
      }

      const { organization } = await response.json();
      onContinue(organization.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: <Users className="w-5 h-5" />,
      title: 'Team Collaboration',
      description:
        'Share EOS tools and AI assistants across your leadership team',
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Centralized Billing',
      description:
        'One subscription covers all team members with flexible seat management',
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: 'Organization Controls',
      description: 'Manage team access, permissions, and shared resources',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="lg" nested>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="w-6 h-6" />
            {existingOrg ? 'Your Organization' : 'Set Up Your Organization'}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {existingOrg
              ? "You're ready to upgrade to Business with your organization"
              : 'Business subscriptions require an organization for team collaboration'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {checkingExisting ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Checking organization status...
              </p>
            </div>
          ) : existingOrg ? (
            /* Show existing organization */
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Organization Details</h4>
                  <Badge variant="secondary">{existingOrg.plan} Plan</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium">Name:</span> {existingOrg.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Seats:</span>{' '}
                  {existingOrg.seatCount}
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You&apos;re ready to upgrade to Business! Your organization will be
                  billed for the Business subscription.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              {/* Benefits */}
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-3"
                  >
                    <div className="p-2 rounded-lg bg-muted h-fit">
                      {benefit.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{benefit.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {benefit.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Create or Join Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as 'create' | 'join')}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create">Create Organization</TabsTrigger>
                  <TabsTrigger value="join">Join Organization</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      placeholder="e.g., Acme Corporation"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      You&apos;ll be able to invite team members after creating the
                      organization
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="join" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-code">Invite Code</Label>
                    <Input
                      id="invite-code"
                      placeholder="Enter 6-character code"
                      value={inviteCode}
                      onChange={(e) =>
                        setInviteCode(e.target.value.toUpperCase())
                      }
                      maxLength={6}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ask your administrator for the organization invite code
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {existingOrg ? (
            <Button
              onClick={() => onContinue(existingOrg.id)}
              disabled={loading}
            >
              Continue to Business Upgrade
            </Button>
          ) : (
            <Button
              onClick={
                activeTab === 'create'
                  ? handleCreateOrganization
                  : handleJoinOrganization
              }
              disabled={loading}
            >
              {loading
                ? 'Processing...'
                : activeTab === 'create'
                  ? 'Create Organization'
                  : 'Join Organization'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
