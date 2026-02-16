'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2,
  Users,
  Shield,
  AlertCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';

export default function SetupOrganizationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [organizationName, setOrganizationName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const check = async () => {
      try {
        const [orgRes, settingsRes] = await Promise.all([
          fetch('/api/organizations', { signal: controller.signal }),
          fetch('/api/user-settings', { signal: controller.signal }),
        ]);

        if (orgRes.ok) {
          const orgData = await orgRes.json();
          if (orgData.organization) {
            router.replace('/chat');
            return;
          }
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.companyName) {
            setOrganizationName((current) => current || settingsData.companyName);
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Setup check failed:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    };

    check();
    return () => controller.abort();
  }, [router]);

  const handleCreate = async () => {
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
        if (data.error?.includes('already belong to an organization')) {
          router.replace('/chat');
          return;
        }
        throw new Error(data.error || 'Failed to create organization');
      }

      router.replace('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
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

      router.replace('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Image
              src="/images/eos-logo.png"
              alt="EOS AI"
              width={48}
              height={48}
              className="rounded-lg"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Set Up Your Organization
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Your Business plan requires an organization for team collaboration,
            shared personas, and centralized billing.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-6">
          <div className="space-y-3">
            {[
              {
                icon: <Users className="w-4 h-4" />,
                title: 'Team Collaboration',
                desc: 'Share AI assistants and EOS tools across your leadership team',
              },
              {
                icon: <Shield className="w-4 h-4" />,
                title: 'Centralized Billing',
                desc: 'One subscription covers all team members',
              },
              {
                icon: <Building2 className="w-4 h-4" />,
                title: 'Organization Controls',
                desc: 'Manage access, permissions, and shared resources',
              },
            ].map((benefit) => (
              <div key={benefit.title} className="flex gap-3 items-start">
                <div className="p-1.5 rounded-md bg-muted shrink-0">
                  {benefit.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as 'create' | 'join');
              setError(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="join">Join Existing</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="setup-org-name">Organization Name</Label>
                <Input
                  id="setup-org-name"
                  placeholder="e.g., Acme Corporation"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  You can invite team members after creating the organization.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={loading || !organizationName.trim()}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Creating...' : 'Create Organization'}
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="setup-invite-code">Invite Code</Label>
                <Input
                  id="setup-invite-code"
                  placeholder="Enter 6-character code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoin();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Ask your administrator for the organization invite code.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleJoin}
                disabled={loading || !inviteCode.trim()}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Joining...' : 'Join Organization'}
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
