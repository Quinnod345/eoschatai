'use client';

import { useState, useEffect } from 'react';

/**
 * A custom hook for responsive design that detects if a media query matches
 * @param query The media query to check, e.g. '(max-width: 640px)'
 * @returns Boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Default to false to support SSR
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Create media query list
    const media = window.matchMedia(query);

    // Update state based on query match
    const updateMatches = () => {
      setMatches(media.matches);
    };

    // Set initial value
    updateMatches();

    // Add listener for changes
    if (media.addEventListener) {
      media.addEventListener('change', updateMatches);
      return () => media.removeEventListener('change', updateMatches);
    } else {
      // Legacy support for older browsers
      media.addListener(updateMatches);
      return () => media.removeListener(updateMatches);
    }
  }, [query]);

  return matches;
}
