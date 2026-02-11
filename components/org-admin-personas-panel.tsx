'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Shield, RefreshCw, Trash2 } from 'lucide-react';

type OrgSharedPersona = {
  id: string;
  name: string;
  description: string | null;
  lockInstructions: boolean;
  lockKnowledge: boolean;
  allowUserOverlay: boolean;
  allowUserKnowledge: boolean;
  updatedAt: string;
  ownerEmail: string | null;
};

export function OrgAdminPersonasPanel({ orgId }: { orgId: string }) {
  const [personas, setPersonas] = useState<OrgSharedPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPersonas = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await fetch(`/api/organizations/${orgId}/personas`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load shared personas');
      }
      setPersonas((payload.personas || []) as OrgSharedPersona[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load shared personas',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, [orgId]);

  const handleDelete = async (personaId: string) => {
    try {
      setDeletingId(personaId);
      const response = await fetch(`/api/personas/${personaId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete shared persona');
      }
      toast.success('Shared persona deleted');
      await fetchPersonas(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete shared persona',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Admin Shared Personas
            </CardTitle>
            <CardDescription>
              Manage all organization-shared personas and their access controls.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchPersonas(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading shared personas...</p>
        ) : personas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No shared personas have been published in this organization.
          </p>
        ) : (
          <div className="space-y-2">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className="rounded-md border p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{persona.name}</p>
                  {persona.description ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {persona.description}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-1">
                    Owner: {persona.ownerEmail || 'Unknown'} • Updated{' '}
                    {new Date(persona.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {persona.lockInstructions ? (
                      <Badge variant="secondary">Instructions Locked</Badge>
                    ) : (
                      <Badge variant="outline">Instructions Visible</Badge>
                    )}
                    {persona.lockKnowledge ? (
                      <Badge variant="secondary">Knowledge Locked</Badge>
                    ) : (
                      <Badge variant="outline">Knowledge Visible</Badge>
                    )}
                    {persona.allowUserOverlay ? (
                      <Badge variant="default">User Overlay Enabled</Badge>
                    ) : null}
                    {persona.allowUserKnowledge ? (
                      <Badge variant="default">User Docs Enabled</Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(persona.id)}
                  disabled={deletingId === persona.id}
                >
                  {deletingId === persona.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
