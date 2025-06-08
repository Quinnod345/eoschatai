'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ClientRedirectProps {
  path: string;
}

export default function ClientRedirect({ path }: ClientRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(path);
  }, [path, router]);

  // Show a minimal loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eos-orange" />
    </div>
  );
}
