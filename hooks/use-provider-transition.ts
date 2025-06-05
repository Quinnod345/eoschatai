import { useState } from 'react';

export function useProviderTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);

  return {
    isTransitioning,
    setIsTransitioning,
  };
}
