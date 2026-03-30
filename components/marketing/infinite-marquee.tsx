'use client';

interface InfiniteMarqueeProps {
  children: React.ReactNode;
  speed?: number;
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
  className?: string;
}

export default function InfiniteMarquee({
  children,
  speed = 40,
  direction = 'left',
  pauseOnHover = true,
  className = '',
}: InfiniteMarqueeProps) {
  const animationDirection = direction === 'left' ? 'normal' : 'reverse';

  return (
    <div
      className={`group overflow-hidden ${className}`}
    >
      <div
        className={`marquee-track flex w-max ${pauseOnHover ? 'group-hover:[animation-play-state:paused]' : ''}`}
        style={{
          animation: `marqueeScroll ${speed}s linear infinite`,
          animationDirection,
        }}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  );
}
