'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Link2,
  CheckCircle2,
  Building2,
  AlertTriangle,
  Info,
} from 'lucide-react';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAccountStore } from '@/lib/stores/account-store';
import { toast } from '@/lib/toast-system';
import { showEdgeCaseToast } from '@/lib/ui/edge-case-messages';

interface CircleConnectFlowProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ConnectResponse = {
  success: boolean;
  member: {
    id: string | null;
    email: string | null;
    tierName: string;
    mappedPlan: 'free' | 'pro' | 'business';
  };
  org: {
    id: string;
    name: string | null;
    plan: 'free' | 'pro' | 'business';
    subscriptionSource: 'stripe' | 'circle';
  } | null;
  canCreateResourceOrg: boolean;
  warning?: string;
  notice?: string;
  warningCode?: string;
  warningAction?: string;
  activeStripePlan?: 'pro' | 'business' | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function CircleConnectFlow({
  open,
  onClose,
  onSuccess,
}: CircleConnectFlowProps) {
  const accountUser = useAccountStore((state) => state.user);
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [openingStripePortal, setOpeningStripePortal] = useState(false);
  const [result, setResult] = useState<ConnectResponse | null>(null);

  const defaultOrgName = useMemo(() => {
    const accountEmail = accountUser?.email?.trim() ?? '';
    if (!accountEmail.includes('@')) return 'Circle Team';
    return `${accountEmail.split('@')[0]}'s Circle Team`;
  }, [accountUser?.email]);

  useEffect(() => {
    if (!open) return;
    setOrgName('');
    setError(null);
    setNotFoundEmail(null);
    setLoading(false);
    setCreatingOrg(false);
    setOpeningStripePortal(false);
    setResult(null);
  }, [open]);

  const refreshAccount = () => {
    window.dispatchEvent(new Event('account-refresh'));
    onSuccess?.();
  };

  const connectMembership = async (options?: {
    createOrg?: boolean;
    orgName?: string;
  }) => {
    setError(null);
    setNotFoundEmail(null);
    setLoading(!options?.createOrg);
    setCreatingOrg(Boolean(options?.createOrg));

    try {
      const response = await fetch('/api/integrations/circle/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createOrg: options?.createOrg ?? false,
          orgName: options?.orgName,
        }),
      });

      const data = (await response.json()) as unknown;
      if (!response.ok) {
        if (isRecord(data) && data.code === 'CIRCLE_MEMBER_NOT_FOUND') {
          const emailUsed =
            typeof data.emailUsed === 'string'
              ? data.emailUsed
              : (accountUser?.email ?? null);
          setNotFoundEmail(emailUsed);
          await showEdgeCaseToast(toast, data);
          return;
        }

        await showEdgeCaseToast(toast, data, {
          fallback: 'Failed to connect Circle membership',
        });

        const message =
          isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Failed to connect Circle membership';
        throw new Error(message);
      }

      const connectData = data as ConnectResponse;
      setResult(connectData);
      setNotFoundEmail(null);
      toast.success('Circle membership connected');
      if (connectData.warning) {
        await showEdgeCaseToast(toast, connectData);
      } else if (connectData.notice) {
        await showEdgeCaseToast(toast, connectData);
      }
      refreshAccount();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to connect Circle membership',
      );
    } finally {
      setLoading(false);
      setCreatingOrg(false);
    }
  };

  const onInitialConnect = async () => {
    if (!accountUser?.email || !accountUser.email.includes('@')) {
      setError(
        'Your account does not have a valid email. Please update your account email and try again.',
      );
      return;
    }

    await connectMembership();
  };

  const onCreateResourceOrg = async () => {
    await connectMembership({
      createOrg: true,
      orgName: orgName.trim() || defaultOrgName,
    });
  };

  const openStripePortal = async () => {
    setOpeningStripePortal(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await response.json()) as unknown;
      if (!response.ok || !isRecord(data) || typeof data.url !== 'string') {
        await showEdgeCaseToast(toast, data, {
          fallback: 'Failed to open Stripe billing portal',
        });
        throw new Error(
          isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Failed to open Stripe billing portal',
        );
      }
      toast.success('Opening Stripe billing portal...');
      window.location.href = data.url;
    } catch (portalError) {
      setError(
        portalError instanceof Error
          ? portalError.message
          : 'Failed to open Stripe billing portal',
      );
    } finally {
      setOpeningStripePortal(false);
    }
  };

  const isConnected = Boolean(result);
  const showResourceOrgPrompt =
    result?.member.mappedPlan === 'business' && result?.canCreateResourceOrg;
  const openProfileSettings = () => {
    window.location.href = '/chat?settings=profile';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Connect Circle Membership
          </DialogTitle>
          <DialogDescription>
            Link your Circle account to sync your EOS AI plan from your Circle
            tier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!result ? (
            <>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-sm font-medium">Using your account email</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {accountUser?.email || 'No account email found'}
                </p>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Circle connected. Your plan is now synced to{' '}
                  <strong>{result.member.mappedPlan}</strong>.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Detected Circle tier</span>
                  <Badge variant="secondary">{result.member.tierName}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Membership email: {result.member.email || accountUser?.email}
                </p>
              </div>

              {showResourceOrgPrompt && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <p className="text-sm font-medium">
                      Create a resource-sharing organization
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mastery includes a Circle-linked org for sharing personas and
                    resources. It does not share subscription access.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="circle-org-name">Organization name</Label>
                    <Input
                      id="circle-org-name"
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      placeholder={defaultOrgName}
                      disabled={creatingOrg}
                    />
                  </div>
                  <Button
                    onClick={onCreateResourceOrg}
                    disabled={creatingOrg}
                    className="w-full"
                    variant="outline"
                  >
                    {creatingOrg ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating organization...
                      </>
                    ) : (
                      'Create Circle Organization'
                    )}
                  </Button>
                </div>
              )}

              {result.org && (
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-sm">
                    Connected organization: <strong>{result.org.name}</strong>
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {notFoundEmail && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">
                We could not find your Circle membership
              </p>
              <p className="text-xs text-muted-foreground">
                Searched email: <strong>{notFoundEmail}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Make sure your EOS AI account email matches your Circle
                membership email.
              </p>
              <p className="text-xs text-muted-foreground">
                If your Circle account uses a different email, update your EOS AI
                account email in Settings to match, then try again.
              </p>
              <Button variant="outline" size="sm" onClick={openProfileSettings}>
                Open Settings
              </Button>
            </div>
          )}

          {result?.warning && (
            <div className="space-y-2">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{result.warning}</AlertDescription>
              </Alert>
              {result.activeStripePlan && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openStripePortal}
                  disabled={openingStripePortal}
                >
                  {openingStripePortal ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening billing portal...
                    </>
                  ) : (
                    'Cancel Stripe Subscription'
                  )}
                </Button>
              )}
            </div>
          )}

          {result?.notice && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{result.notice}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {isConnected ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={onInitialConnect}
              disabled={loading || !accountUser?.email}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Circle'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
