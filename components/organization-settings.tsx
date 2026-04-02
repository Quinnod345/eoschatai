'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Copy,
  Users,
  Building2,
  CreditCard,
  UserPlus,
  LogOut,
  UserX,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAccountStore } from '@/lib/stores/account-store';
import { toast } from 'sonner';
import { OrganizationModal } from '@/components/organization-modal';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OrgKnowledgeManager } from '@/components/org-knowledge-manager';
import { OrgUsageDashboard } from '@/components/org-usage-dashboard';
import { OrgAdminPersonasPanel } from '@/components/org-admin-personas-panel';

interface OrganizationMember {
  id: string;
  email: string;
  displayName?: string;
  profilePicture?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export function OrganizationSettings() {
  const org = useAccountStore((state) => state.org);
  const user = useAccountStore((state) => state.user);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [memberUsageById, setMemberUsageById] = useState<
    Record<string, { chats_today: number; uploads_total: number }>
  >({});
  const [inviteCode, setInviteCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const router = useRouter();

  // Listen for organization modal open event
  useEffect(() => {
    const handleOpenOrgModal = () => setShowOrgModal(true);
    window.addEventListener('openOrganizationModal', handleOpenOrgModal);
    return () =>
      window.removeEventListener('openOrganizationModal', handleOpenOrgModal);
  }, []);

  useEffect(() => {
    if (org) {
      fetchOrganizationData();
    }
  }, [org]);

  const fetchOrganizationData = async () => {
    if (!org) return;

    try {
      // Fetch organization members
      const membersRes = await fetch(`/api/organizations/${org.id}/members`);
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members);
      }

      // Fetch invite code
      const inviteRes = await fetch(`/api/organizations/${org.id}/invite-code`);
      if (inviteRes.ok) {
        const data = await inviteRes.json();
        setInviteCode(data.inviteCode);
      }

      // Fetch per-member usage summary for member management visibility
      const usageRes = await fetch(`/api/organizations/${org.id}/usage`);
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        const usageMap: Record<string, { chats_today: number; uploads_total: number }> = {};
        for (const memberUsage of usageData.members || []) {
          usageMap[memberUsage.id] = {
            chats_today: memberUsage.usageCounters?.chats_today || 0,
            uploads_total: memberUsage.usageCounters?.uploads_total || 0,
          };
        }
        setMemberUsageById(usageMap);
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const seatsUsed = members.length;
  const seatsTotal = org?.seatCount ?? 0;
  const isCircleResourceOrg = org?.subscriptionSource === 'circle';
  const seatsFull = isCircleResourceOrg
    ? false
    : seatsTotal > 0
      ? seatsUsed >= seatsTotal
      : false;

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Invite code copied to clipboard');
  };

  const regenerateInviteCode = async () => {
    if (!org) return;

    try {
      const response = await fetch(`/api/organizations/${org.id}/invite-code`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setInviteCode(data.inviteCode);
        toast.success('New invite code generated');
      }
    } catch (error) {
      toast.error('Failed to regenerate invite code');
    }
  };

  const handleLeaveOrganization = async () => {
    try {
      const response = await fetch('/api/organizations/leave', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Successfully left the organization');
        // Refresh account data
        const refreshEvent = new Event('account-refresh');
        window.dispatchEvent(refreshEvent);
        // Redirect to main page
        router.push('/chat');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to leave organization');
      }
    } catch (error) {
      toast.error('Failed to leave organization');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!org) return;

    try {
      const response = await fetch(
        `/api/organizations/${org.id}/members/${memberId}`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok) {
        toast.success('Member removed successfully');
        fetchOrganizationData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove member');
      }
    } catch (error) {
      toast.error('Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleChangeRole = async (
    memberId: string,
    newRole: 'owner' | 'admin' | 'member',
  ) => {
    if (!org) return;

    try {
      const endpoint =
        newRole === 'owner'
          ? `/api/organizations/${org.id}/transfer-ownership`
          : `/api/organizations/${org.id}/members/${memberId}/role`;
      const payload =
        newRole === 'owner'
          ? { newOwnerId: memberId }
          : { role: newRole };
      const method = newRole === 'owner' ? 'POST' : 'PATCH';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(
          newRole === 'owner'
            ? 'Ownership transferred successfully'
            : 'Role updated successfully',
        );
        if (newRole === 'owner') {
          const refreshEvent = new Event('account-refresh');
          window.dispatchEvent(refreshEvent);
        }
        fetchOrganizationData();
      } else {
        const data = await response.json();
        toast.error(
          data.error ||
            (newRole === 'owner'
              ? 'Failed to transfer ownership'
              : 'Failed to change role'),
        );
      }
    } catch (error) {
      toast.error(
        newRole === 'owner'
          ? 'Failed to transfer ownership'
          : 'Failed to change role',
      );
    }
  };

  const currentUserRole =
    members.find((m) => m.id === user?.id)?.role || 'member';
  const isOwner = currentUserRole === 'owner';
  const canDeleteOrgKnowledge =
    currentUserRole === 'owner' || currentUserRole === 'admin';
  const canManageSharedPersonas =
    currentUserRole === 'owner' || currentUserRole === 'admin';

  if (!org) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>No Organization</CardTitle>
            <CardDescription>
              You&apos;re not part of an organization yet. Join or create one to access
              Business features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                onClick={() => setShowOrgModal(true)}
                className="w-full"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Create or Join Organization
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Organization Modal - must be rendered even when no org exists */}
        <OrganizationModal
          open={showOrgModal}
          onClose={() => setShowOrgModal(false)}
          onContinue={async (orgId) => {
            setShowOrgModal(false);
            // Refresh the account data to get the new organization
            const refreshEvent = new Event('account-refresh');
            window.dispatchEvent(refreshEvent);
            toast.success('Organization created successfully!');
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5" />
              <div>
                <CardTitle>{org.name}</CardTitle>
                <CardDescription>Organization Settings</CardDescription>
              </div>
            </div>
            <Badge
              variant={
                org.subscriptionSource === 'circle'
                  ? 'outline'
                  : org.plan === 'business'
                    ? 'default'
                    : 'secondary'
              }
            >
              {org.subscriptionSource === 'circle'
                ? 'Circle Resource Org'
                : org.plan === 'pro'
                  ? 'Strengthen'
                  : org.plan === 'business'
                    ? 'Mastery'
                    : 'Discovery'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm text-muted-foreground">
                Organization ID
              </Label>
              <p className="text-sm font-mono">{org.id}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Seats</Label>
              <div className="flex flex-wrap items-center gap-2">
                {isCircleResourceOrg ? (
                  <p className="text-sm">Unlimited (Circle resource-sharing org)</p>
                ) : (
                  <p className="text-sm">
                    {members.length} / {org.seatCount} used
                  </p>
                )}
                {isOwner && !isCircleResourceOrg && (
                  <SeatEditor
                    orgId={org.id}
                    current={org.seatCount}
                    used={members.length}
                  />
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Your Role</Label>
              <Badge variant={isOwner ? 'default' : 'secondary'}>
                {currentUserRole}
              </Badge>
            </div>
          </div>
          <div className="pt-4 border-t">
            <Button
              onClick={() => setShowLeaveDialog(true)}
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave Organization
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invite Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite Team Members
          </CardTitle>
          <CardDescription>
            {isOwner
              ? seatsFull
                ? 'All seats are in use. Increase seats to invite more members.'
                : 'Share this code to invite people to your organization.'
              : 'Only the organization owner can invite members.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={isOwner && !seatsFull ? inviteCode : ''}
              placeholder={
                !isOwner
                  ? 'Only owner can generate invite codes'
                  : seatsFull
                    ? 'Seats full — upgrade seats to invite more'
                    : 'Invite code will appear here'
              }
              readOnly
              className="font-mono text-lg tracking-wider"
            />
            <Button
              onClick={copyInviteCode}
              variant="outline"
              disabled={!isOwner || seatsFull || !inviteCode}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={regenerateInviteCode}
            variant="outline"
            className="w-full"
            disabled={!isOwner || seatsFull}
          >
            {seatsFull
              ? 'Seats Full — Upgrade to Add Seats'
              : 'Generate New Code'}
          </Button>

          {/* Email invite form */}
          {isOwner && (
            <>
              <EmailInviteForm
                orgId={org.id}
                disabled={seatsFull}
                onInviteSent={() => {
                  // Trigger a refresh of pending invitations
                  window.dispatchEvent(new Event('refresh-invitations'));
                }}
              />
              <PendingInvitations orgId={org.id} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <OrgKnowledgeManager orgId={org.id} canDelete={canDeleteOrgKnowledge} />

      <OrgUsageDashboard orgId={org.id} />

      {canManageSharedPersonas ? <OrgAdminPersonasPanel orgId={org.id} /> : null}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            {members.length} member{members.length !== 1 ? 's' : ''} in your
            organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="space-y-1">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-40 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profilePicture} />
                      <AvatarFallback>
                        {member.displayName?.[0] ||
                          member.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member.displayName || member.email}
                        {member.id === user?.id && ' (You)'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Chats today: {memberUsageById[member.id]?.chats_today || 0} •
                        Uploads: {memberUsageById[member.id]?.uploads_total || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Role dropdown - only for owners changing non-owner roles */}
                    {isOwner && member.id !== user?.id ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            {member.role}
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member.id, 'admin')}
                            disabled={member.role === 'admin'}
                          >
                            Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleChangeRole(member.id, 'member')
                            }
                            disabled={member.role === 'member'}
                          >
                            Member
                          </DropdownMenuItem>
                          {/* Only show owner option if current user is owner */}
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member.id, 'owner')}
                            disabled={member.role === 'owner'}
                          >
                            Owner
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge
                        variant={
                          member.role === 'owner'
                            ? 'default'
                            : member.role === 'admin'
                              ? 'outline'
                              : 'secondary'
                        }
                      >
                        {member.role}
                      </Badge>
                    )}

                    {/* Remove button - only for owners removing non-owner members */}
                    {isOwner &&
                      member.id !== user?.id &&
                      member.role !== 'owner' && (
                        <Button
                          onClick={() => setRemovingMemberId(member.id)}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing - Only show for owners */}
      {org.plan !== 'free' && isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Organization Billing
            </CardTitle>
            <CardDescription>
              Manage your {org.plan} subscription and billing details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">Current Plan</p>
                <p className="text-2xl font-bold capitalize">{org.plan}</p>
                <p className="text-sm text-muted-foreground">
                  {org.seatCount} seats • Billed to organization
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/billing/portal', {
                      method: 'POST',
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    }
                  } catch {
                    toast.error('Unable to open billing portal');
                  }
                }}
              >
                Manage Subscription in Stripe
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Info for Members */}
      {org.plan !== 'free' && !isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Organization Subscription
            </CardTitle>
            <CardDescription>
              Your organization has an active subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Current Plan</p>
              <p className="text-2xl font-bold capitalize">{org.plan}</p>
              <p className="text-sm text-muted-foreground">
                Managed by organization owner
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization Modal */}
      <OrganizationModal
        open={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        onContinue={async (orgId) => {
          setShowOrgModal(false);
          // Refresh the account data to get the new organization
          const refreshEvent = new Event('account-refresh');
          window.dispatchEvent(refreshEvent);
          toast.success('Organization created successfully!');
        }}
      />

      {/* Leave Organization Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave {org.name}? You&apos;ll lose access to
              all organization resources and features.
              {isOwner && members.length > 1 && (
                <span className="block mt-2 font-semibold text-destructive">
                  As the owner, you must transfer ownership before leaving.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveOrganization}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Dialog */}
      <AlertDialog
        open={!!removingMemberId}
        onOpenChange={(open) => !open && setRemovingMemberId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the organization?
              They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removingMemberId && handleRemoveMember(removingMemberId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SeatEditor({
  orgId,
  current,
  used,
}: { orgId: string; current: number; used: number }) {
  const [seatCount, setSeatCount] = React.useState<number>(current);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSeatCount(current);
  }, [current]);

  const canDecrease = seatCount > used;
  const canIncrease = seatCount < 10000; // arbitrary upper guard

  const apply = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/organizations/${orgId}/seats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatCount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update seats');
      }
      const refreshEvent = new Event('account-refresh');
      window.dispatchEvent(refreshEvent);
      toast.success('Seats updated');
    } catch (e: any) {
      setError(e?.message || 'Failed to update seats');
      toast.error(e?.message || 'Failed to update seats');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 max-w-full">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setSeatCount((v) => Math.max(used, v - 1))}
        disabled={!canDecrease || saving}
        className="shrink-0"
      >
        −
      </Button>
      <Input
        value={seatCount}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value || '0', 10);
          if (!Number.isNaN(v)) setSeatCount(Math.max(used, v));
        }}
        className="w-20 text-center shrink-0"
        type="number"
        min={used}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setSeatCount((v) => Math.min(10000, v + 1))}
        disabled={!canIncrease || saving}
        className="shrink-0"
      >
        +
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={apply}
        disabled={saving || seatCount === current}
        className="shrink-0"
      >
        {saving ? 'Saving...' : 'Update'}
      </Button>
      {error && <span className="text-xs text-destructive ml-2">{error}</span>}
    </div>
  );
}

function EmailInviteForm({
  orgId,
  disabled,
  onInviteSent,
}: { orgId: string; disabled?: boolean; onInviteSent?: () => void }) {
  const [email, setEmail] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const send = async () => {
    if (!email) return;
    try {
      setSending(true);
      const res = await fetch(`/api/organizations/${orgId}/email-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to send invite');
      }
      toast.success('Invitation sent');
      setEmail('');
      onInviteSent?.();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">Invite by email</Label>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled || sending}
        />
        <Button onClick={send} disabled={!email || disabled || sending}>
          {sending ? 'Sending…' : 'Send Invite'}
        </Button>
      </div>
      {disabled && (
        <p className="text-xs text-muted-foreground">
          Seats are full. Increase seats to invite more members.
        </p>
      )}
    </div>
  );
}

function PendingInvitations({ orgId }: { orgId: string }) {
  const [invitations, setInvitations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/organizations/${orgId}/invitations`);
      if (!res.ok) throw new Error('Failed to fetch invitations');
      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchInvitations();

    // Listen for refresh events
    const handleRefresh = () => fetchInvitations();
    window.addEventListener('refresh-invitations', handleRefresh);

    return () => {
      window.removeEventListener('refresh-invitations', handleRefresh);
    };
  }, [orgId]);

  const cancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/invitations?id=${invitationId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to cancel invitation');
      toast.success('Invitation cancelled');
      fetchInvitations();
    } catch (error) {
      toast.error('Failed to cancel invitation');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      sent: { label: 'Sent', className: 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300' },
      delivered: { label: 'Delivered', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
      opened: { label: 'Opened', className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
      clicked: { label: 'Clicked', className: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
      bounced: { label: 'Bounced', className: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
      failed: { label: 'Failed', className: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
    };
    const badge = badges[status as keyof typeof badges] || badges.sent;
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          badge.className,
        )}
      >
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading invitations...
      </div>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">
        Pending Invitations
      </Label>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {invitation.email}
                </span>
                {getStatusBadge(invitation.status)}
              </div>
              <div className="text-xs text-muted-foreground">
                Invited {new Date(invitation.sentAt).toLocaleDateString()}
                {invitation.isExpired && ' • Expired'}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelInvitation(invitation.id)}
              className="ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
