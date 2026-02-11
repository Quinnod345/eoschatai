'use client';

import { useEffect, useState } from 'react';
import { useAccountStore } from '@/lib/stores/account-store';

export type OrgRole = 'owner' | 'admin' | 'member';

export function useOrgRole() {
  const org = useAccountStore((state) => state.org);
  const user = useAccountStore((state) => state.user);
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org?.id || !user?.id) {
      setOrgRole(null);
      return;
    }

    let cancelled = false;
    const loadRole = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/organizations/${org.id}/members`);
        if (!response.ok) {
          if (!cancelled) {
            setOrgRole(null);
          }
          return;
        }
        const payload = await response.json();
        const member = (payload.members || []).find((m: any) => m.id === user.id);
        if (!cancelled) {
          const role = member?.role;
          setOrgRole(
            role === 'owner' || role === 'admin' || role === 'member'
              ? role
              : null,
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, [org?.id, user?.id]);

  return {
    orgRole,
    isOrgAdmin: orgRole === 'owner' || orgRole === 'admin',
    loading,
  };
}
