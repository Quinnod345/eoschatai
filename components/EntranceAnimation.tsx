'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import Image from 'next/image';
import { useTheme } from 'next-themes';

export default function EntranceAnimation({
  onAnimationComplete,
}: { onAnimationComplete: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    // Prevent body scrolling during animation
    document.body.style.overflow = 'hidden';

    // Create a GSAP timeline
    const tl = gsap.timeline({
      onComplete: () => {
        onAnimationComplete();
        document.body.style.overflow = '';
      },
    });

    // Initial states
    gsap.set(logoRef.current, {
      scale: 0.1,
      opacity: 0,
      filter: 'blur(20px)',
      rotation: -15,
    });
    gsap.set(glowRef.current, { scale: 0, opacity: 0 });

    // Animation sequence
    tl
      // First add a slight delay before starting
      .to({}, { duration: 0.2 })

      // Animate in the glow
      .to(glowRef.current, {
        duration: 0.5,
        scale: 1.2,
        opacity: 0.8,
        ease: 'power2.out',
      })

      // Animate in the logo
      .to(
        logoRef.current,
        {
          duration: 1.2,
          opacity: 1,
          filter: 'blur(0px)',
          scale: 1,
          rotation: 0,
          ease: 'power3.out',
        },
        '-=0.7',
      )

      // Zoom logo
      .to(logoRef.current, {
        duration: 1.5,
        scale: 20,
        ease: 'power3.in', // Changed from power2.inOut to power3.in for acceleration
      })

      // Fade out logo as it gets bigger
      .to(
        logoRef.current,
        {
          duration: 0.9,
          opacity: 0,
          filter: 'blur(40px)', // Added blur effect
          ease: 'power2.in',
        },
        '-=1.3', // Started earlier (changed from -=0.9 to -=1.3)
      )

      // Fade out the glow
      .to(
        glowRef.current,
        {
          duration: 0.7,
          opacity: 0,
          scale: 4,
          filter: 'blur(60px)',
          ease: 'power3.in',
        },
        '-=1.2',
      )

      // Finally fade out the overlay
      .to(
        overlayRef.current,
        {
          duration: 0.8,
          opacity: 0,
          ease: 'power2.inOut',
          pointerEvents: 'none',
        },
        '-=1.0',
      );

    return () => {
      // Cleanup
      tl.kill();
      document.body.style.overflow = '';
    };
  }, [onAnimationComplete, isMounted]);

  // Don't render anything during SSR
  if (!isMounted) return null;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 ${resolvedTheme === 'dark' ? 'bg-[#142233]' : 'bg-white'} z-[9999] flex items-center justify-center pointer-events-auto`}
    >
      {/* Background glow effect */}
      <div
        ref={glowRef}
        className="absolute w-[300px] h-[300px] rounded-full bg-gradient-to-r from-eos-orange/30 to-eos-orangeLight/30 blur-3xl"
      />

      {/* Logo container */}
      <div
        ref={logoRef}
        className="relative w-32 h-32 md:w-48 md:h-48 flex items-center justify-center"
      >
        <Image
          src={
            resolvedTheme === 'dark'
              ? '/images/eos-logo-dark-mode.png'
              : '/images/eos-logo.png'
          }
          alt="EOS Logo"
          fill
          priority
          className="object-contain"
        />
      </div>
    </div>
  );
}
