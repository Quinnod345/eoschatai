'use client';

import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import useSWR from 'swr';

interface ComposerCountPillProps {
  userId: string;
  userPlan: 'free' | 'pro' | 'business';
  className?: string;
}

export function ComposerCountPill({
  userId,
  userPlan,
  className,
}: ComposerCountPillProps) {
  // Always call hooks at the top level
  const { data: count, mutate } = useSWR(
    userPlan === 'business' ? `/api/documents/count?userId=${userId}` : null,
    async () => {
      const response = await fetch(`/api/documents/count?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        return data.count || 0;
      }
      return 0;
    },
    {
      refreshInterval: 10000, // Refresh every 10 seconds
    },
  );

  // Listen for document creation events to update count
  useEffect(() => {
    if (userPlan !== 'business') return;

    const handleDocumentCreated = () => {
      mutate();
    };

    window.addEventListener('composer-created', handleDocumentCreated);
    return () => {
      window.removeEventListener('composer-created', handleDocumentCreated);
    };
  }, [mutate, userPlan]);

  // Only show for Business users
  if (userPlan !== 'business') {
    return null;
  }

  return (
    <Badge variant="secondary" className={className}>
      <FileText className="h-3 w-3 mr-1" />
      {count || 0} Composers
    </Badge>
  );
}
