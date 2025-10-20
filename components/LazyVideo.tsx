'use client';

import { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  poster?: string;
}

export default function LazyVideo({
  src,
  className = '',
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  preload = 'none',
  poster,
}: LazyVideoProps) {
  const [isInView, setIsInView] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsInView(true);
            setHasLoaded(true);
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0.01,
      },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [hasLoaded]);

  // Handle video playback based on visibility
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // Ignore autoplay errors
            });
          } else {
            video.pause();
          }
        });
      },
      {
        threshold: 0.25,
      },
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [isInView]);

  return (
    <div ref={containerRef} className={className}>
      {isInView ? (
        <video
          ref={videoRef}
          className="w-full h-auto"
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          preload={preload}
          poster={poster}
          style={{
            willChange: 'auto',
            transform: 'translateZ(0)',
          }}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <div className="w-full aspect-video bg-gradient-to-br from-white/10 to-white/5 animate-pulse" />
      )}
    </div>
  );
}




