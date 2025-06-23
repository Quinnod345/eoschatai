'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';

export default function EntranceAnimation({
  onAnimationComplete,
}: {
  onAnimationComplete: () => void;
}) {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onAnimationComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-40 h-40 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 blur-xl opacity-30" />
        <div className="relative z-10">
          <Image
            src={
              theme === 'dark'
                ? '/eos-logo-dark-mode.png'
                : '/images/eos-logo.png'
            }
            alt="EOS Logo"
            width={120}
            height={120}
            className="drop-shadow-2xl"
            priority
          />
        </div>
      </div>
    </div>
  );
}
