'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building2, Check, Plus } from 'lucide-react';
import { useAccountStore } from '@/lib/stores/account-store';
import { OrganizationModal } from '@/components/organization-modal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'business';
  memberCount?: number;
}

interface OrganizationSwitcherProps {
  onClose?: () => void;
}

export function OrganizationSwitcherTrigger({
  onClick,
}: {
  onClick: () => void;
}) {
  const org = useAccountStore((state) => state.org);

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onClick}>
        <Building2 className="mr-2 h-4 w-4" />
        <div className="flex flex-col items-start">
          <span>Organization</span>
          {org && (
            <span className="text-xs text-muted-foreground">{org.name}</span>
          )}
        </div>
      </DropdownMenuItem>
    </>
  );
}

export function OrganizationSwitcher({ onClose }: OrganizationSwitcherProps) {
  const currentOrg = useAccountStore((state) => state.org);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchUserOrganizations();
  }, []);

  const fetchUserOrganizations = async () => {
    try {
      // Fetch all organizations the user has access to
      const response = await fetch('/api/user/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = async (orgId: string) => {
    if (orgId === currentOrg?.id) {
      onClose?.();
      return;
    }

    setSwitching(true);
    try {
      const response = await fetch('/api/user/switch-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (response.ok) {
        // Refresh the page to reload with new organization context
        window.location.reload();
      } else {
        throw new Error('Failed to switch organization');
      }
    } catch (error) {
      toast.error('Failed to switch organization');
      setSwitching(false);
    }
  };

  const handleCreateOrganization = async (orgId: string) => {
    setShowCreateModal(false);
    await switchOrganization(orgId);
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Switch Organization
            </DialogTitle>
            <DialogDescription>
              Select an organization or create a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Loading organizations...
              </p>
            ) : organizations.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  You&apos;re not part of any organization yet
                </p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Organization
                </Button>
              </div>
            ) : (
              <>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => switchOrganization(org.id)}
                    disabled={switching}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors',
                      'text-left disabled:opacity-50 disabled:cursor-not-allowed',
                      currentOrg?.id === org.id && 'bg-accent',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}{' '}
                          Plan
                          {org.memberCount && ` • ${org.memberCount} members`}
                        </p>
                      </div>
                    </div>
                    {currentOrg?.id === org.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}

                <div className="pt-2">
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="outline"
                    className="w-full"
                    disabled={switching}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Organization
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OrganizationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onContinue={handleCreateOrganization}
      />
    </>
  );
}
