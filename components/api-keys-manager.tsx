'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Key,
  Copy,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  BarChart3,
  Clock,
  AlertTriangle,
  Check,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from '@/lib/toast-system';
import { cn } from '@/lib/utils';
import { Gate } from '@/components/gate';
import { UpgradePrompt } from '@/components/upgrade-prompt';

interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  lastFour: string;
  maskedKey: string;
  requestCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  fullKey?: string; // Only present on creation
}

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  avgResponseTime: number;
  successCount: number;
  errorCount: number;
}

interface ApiKeyUsage {
  key: {
    id: string;
    name: string;
    totalRequests: number;
    lastUsedAt: string | null;
    createdAt: string;
  };
  stats: UsageStats;
  daily: Array<{ date: string; requests: number; tokens: number }>;
}

export function ApiKeysManager() {
  const [keys, setKeys] = React.useState<ApiKeyData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  
  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = React.useState<ApiKeyData | null>(null);
  const [keyCopied, setKeyCopied] = React.useState(false);
  
  // Delete confirmation
  const [keyToDelete, setKeyToDelete] = React.useState<ApiKeyData | null>(null);
  
  // Usage dialog
  const [showUsageDialog, setShowUsageDialog] = React.useState(false);
  const [usageKey, setUsageKey] = React.useState<ApiKeyData | null>(null);
  const [usageData, setUsageData] = React.useState<ApiKeyUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = React.useState(false);

  // Fetch API keys on mount
  React.useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      } else if (res.status === 403) {
        // User doesn't have API access - this is handled by the Gate component
        setKeys([]);
      } else {
        throw new Error('Failed to fetch API keys');
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewlyCreatedKey(data.key);
        setKeys((prev) => [data.key, ...prev]);
        setNewKeyName('');
        setKeyCopied(false);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      setDeleting(keyToDelete.id);
      const res = await fetch(`/api/api-keys/${keyToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== keyToDelete.id));
        toast.success('API key revoked');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to revoke API key');
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    } finally {
      setDeleting(null);
      setKeyToDelete(null);
    }
  };

  const handleViewUsage = async (key: ApiKeyData) => {
    setUsageKey(key);
    setShowUsageDialog(true);
    setLoadingUsage(true);

    try {
      const res = await fetch(`/api/api-keys/${key.id}/usage?days=30`);
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      } else {
        toast.error('Failed to load usage data');
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
      toast.error('Failed to load usage data');
    } finally {
      setLoadingUsage(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setKeyCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setKeyCopied(false), 3000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Gate feature="api_access" fallback={<UpgradePrompt feature="api_access" />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">API Keys</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage API keys for programmatic access to EOSAI
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Key
          </Button>
        </div>

        {/* Keys List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Key className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h4 className="font-medium mb-1">No API keys yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create an API key to start using the EOSAI API
            </p>
            <Button onClick={() => setShowCreateDialog(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first key
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {keys.map((key) => (
              <div
                key={key.id}
                className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{key.name}</span>
                    {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                      <Badge variant="destructive" className="text-xs">Expired</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                      {key.maskedKey}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      Created {formatDate(key.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right mr-2 hidden sm:block">
                    <div className="text-sm font-medium">{key.requestCount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">requests</div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewUsage(key)}
                    className="gap-1"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Usage</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setKeyToDelete(key)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* API Documentation Link */}
        <div className="rounded-lg bg-muted/50 p-4">
          <h4 className="font-medium mb-1">API Documentation</h4>
          <p className="text-sm text-muted-foreground">
            Learn how to integrate EOSAI into your applications.{' '}
            <a
              href="https://docs.eosbot.ai/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View documentation →
            </a>
          </p>
        </div>

        {/* Create Key Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            {newlyCreatedKey ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    API Key Created
                  </DialogTitle>
                  <DialogDescription>
                    Copy your API key now. You won't be able to see it again!
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        This is the only time you'll see this key. Copy it and store it securely.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Your API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newlyCreatedKey.fullKey || ''}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant={keyCopied ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => copyToClipboard(newlyCreatedKey.fullKey || '')}
                        className={cn(keyCopied && 'bg-green-500 hover:bg-green-600')}
                      >
                        {keyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setShowCreateDialog(false);
                      setNewlyCreatedKey(null);
                    }}
                    className="w-full"
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Give your API key a descriptive name to identify it later.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Production Server, Development, CI/CD"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !creating) {
                          handleCreateKey();
                        }
                      }}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setNewKeyName('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateKey}
                    disabled={creating || !newKeyName.trim()}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Key'
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!keyToDelete} onOpenChange={(open) => !open && setKeyToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to revoke <strong>{keyToDelete?.name}</strong>? 
                This action cannot be undone and any applications using this key will stop working immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteKey}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting === keyToDelete?.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  'Revoke Key'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Usage Dialog */}
        <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>API Key Usage</DialogTitle>
              <DialogDescription>
                Usage statistics for <strong>{usageKey?.name}</strong> (last 30 days)
              </DialogDescription>
            </DialogHeader>
            
            {loadingUsage ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : usageData ? (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-2xl font-bold">
                      {usageData.stats.totalRequests.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Requests</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-2xl font-bold">
                      {usageData.stats.totalTokens.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Tokens Used</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-2xl font-bold text-green-500">
                      {usageData.stats.successCount.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-2xl font-bold text-destructive">
                      {usageData.stats.errorCount.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                {/* Key Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Used</span>
                    <span>{formatDateTime(usageData.key.lastUsedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDateTime(usageData.key.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Response Time</span>
                    <span>{usageData.stats.avgResponseTime}ms</span>
                  </div>
                </div>

                {/* Daily Chart (simplified text version) */}
                {usageData.daily.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Daily Activity</h4>
                    <div className="rounded-lg border divide-y max-h-32 overflow-y-auto">
                      {usageData.daily.slice(-7).reverse().map((day) => (
                        <div key={day.date} className="flex justify-between px-3 py-2 text-sm">
                          <span className="text-muted-foreground">
                            {new Date(day.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span>{day.requests.toLocaleString()} requests</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No usage data available
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUsageDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Gate>
  );
}
