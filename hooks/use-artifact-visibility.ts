import { useState } from 'react';

export function useArtifactVisibility() {
  const [isVisible, setIsVisible] = useState(false);

  return {
    isVisible,
    setIsVisible,
  };
}
