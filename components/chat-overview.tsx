'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

// Witty/fun EOS-themed subtitles
const EOS_SUBTITLES = [
  'Ready to Rock?',
  "Let's get some issues solved.",
  'Clarity breaks start here.',
  'Vision without execution is hallucination.',
  "Let's simplify the complex.",
  'Delegate and elevate your day.',
  'Time to work on the business, not just in it.',
  "Let's hit the ceiling and break through.",
  'Greater good time.',
  "Let's find the root cause.",
  'No more duct tape solutions.',
  "Let's get everyone rowing in the same direction.",
];

// Animated character component with blur effect
function AnimatedChar({
  char,
  delay,
}: {
  char: string;
  delay: number;
}) {
  return (
    <motion.span
      initial={{
        opacity: 0,
        filter: 'blur(8px)',
        y: 4,
      }}
      animate={{
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
      }}
      transition={{
        duration: 0.2,
        delay,
        ease: [0.2, 0.65, 0.3, 0.9],
      }}
      className="inline-block"
      style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
    >
      {char === ' ' ? '\u00A0' : char}
    </motion.span>
  );
}

// Animated text that reveals character by character
function BlurRevealText({
  text,
  className,
  baseDelay = 0,
  charDelay = 0.03,
}: {
  text: string;
  className?: string;
  baseDelay?: number;
  charDelay?: number;
}) {
  return (
    <span className={className}>
      {text.split('').map((char, index) => (
        <AnimatedChar
          key={`${index}-${char}`}
          char={char}
          delay={baseDelay + index * charDelay}
        />
      ))}
    </span>
  );
}

export function ChatOverview({
  isVisible,
  userName,
}: {
  isVisible: boolean;
  userName?: string | null;
}) {
  const [greeting, setGreeting] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');

  useEffect(() => {
    const hour = new Date().getHours();
    const name = userName ? `, ${userName.split(' ')[0]}` : ''; // Use first name if available

    if (hour < 12) setGreeting(`Good morning${name}`);
    else if (hour < 18) setGreeting(`Good afternoon${name}`);
    else setGreeting(`Good evening${name}`);

    // Select a random subtitle
    setSubtitle(
      EOS_SUBTITLES[Math.floor(Math.random() * EOS_SUBTITLES.length)],
    );
  }, [userName]);

  // Calculate subtitle delay based on greeting length
  const subtitleDelay = useMemo(() => {
    return 0.05 + greeting.length * 0.018;
  }, [greeting]);

  if (!greeting) return null;

  return (
    <div className="chat-overview-container mb-16 flex flex-col items-center justify-center px-4 text-center sm:mb-24 sm:px-6 md:mb-48">
      <h1 className="chat-overview-title mx-auto w-full max-w-5xl break-words text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
        <BlurRevealText
          text={greeting}
          className="text-orange-500"
          baseDelay={0.05}
          charDelay={0.02}
        />
      </h1>

      <p className="mx-auto mt-2 max-w-xs text-sm font-light italic text-zinc-500 sm:mt-3 sm:max-w-sm sm:text-base md:mt-4 md:max-w-2xl md:text-base lg:text-lg dark:text-zinc-400">
        <BlurRevealText
          text={subtitle}
          baseDelay={subtitleDelay}
          charDelay={0.015}
        />
      </p>
    </div>
  );
}
