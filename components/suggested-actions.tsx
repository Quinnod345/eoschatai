'use client';

import { memo } from 'react';
import type { AppendFunction } from './multimodal-input/types';
import type { VisibilityType } from './visibility-selector';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { springChat, useNoMotion, INSTANT } from '@/lib/motion/presets';
import '../styles/animations.css';

// Time-based greeting options - conversational and warm
const MORNING_GREETINGS = [
  "Good morning! I'm excited to help you with your EOS journey today. What's on your mind?",
  'Rise and shine! Ready to tackle some EOS challenges together?',
  'Morning! What EOS questions are you thinking about as you start your day?',
  'Early bird gets the Rocks done! How can I support your business today?',
  'Good morning! What would you like to explore about EOS over your coffee?',
];

const AFTERNOON_GREETINGS = [
  'Good afternoon! What EOS topic would you like to dive into?',
  'Hope your day is going well! What EOS questions can I help you with?',
  "Afternoon! What's the biggest EOS challenge you're working on right now?",
  "Back from lunch? Let's make some progress on your EOS implementation!",
  'Good afternoon! What aspect of your business would you like to strengthen with EOS?',
];

const EVENING_GREETINGS = [
  'Good evening! What EOS topics would you like to explore tonight?',
  "Evening reflection time! What's been on your mind about your business lately?",
  "Wrapping up your day? Let's work through some EOS concepts together!",
  'Evening! What EOS challenge would you like to tackle before tomorrow?',
  'Good evening! What questions about your business can I help you think through?',
];

// Keep the original interface for backward compatibility
interface SuggestedActionsProps {
  chatId: string;
  append: AppendFunction;
  selectedVisibilityType: VisibilityType;
}

// Replace old implementation with new functionality
function PureSuggestedActions({
  chatId,
  append,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const [greeting, setGreeting] = useState('');
  const quickSend = (text: string) =>
    append(
      {
        role: 'user',
        content: text,
      },
      {},
    );

  // Set time-appropriate random greeting
  useEffect(() => {
    const getRandomGreeting = () => {
      // Get current date
      const date = new Date();

      // Get hour in local timezone
      const hour: number = date.getHours();

      let greetings: string[];

      if (hour < 12) {
        greetings = MORNING_GREETINGS;
      } else if (hour < 18) {
        greetings = AFTERNOON_GREETINGS;
      } else {
        greetings = EVENING_GREETINGS;
      }

      const randomIndex = Math.floor(Math.random() * greetings.length);
      return greetings[randomIndex];
    };

    setGreeting(getRandomGreeting());
  }, []);

  const noMotion = useNoMotion();

  return (
    <div
      data-testid="suggested-actions"
      className="flex flex-col max-w-3xl mx-auto px-4 sm:px-6 suggestions-container min-h-screen"
      style={{
        overflow: 'visible',
        minHeight: 'fit-content',
      }}
    >
      {/* Header section - centered container with left-justified text */}
      <div className="flex flex-col items-center justify-center min-h-screen">
        <motion.div
          className="w-full max-w-2xl"
          {...(noMotion
            ? INSTANT
            : {
                initial: { opacity: 0, y: 12 },
                animate: { opacity: 1, y: 0 },
                transition: springChat,
              })}
        >
          <h2 className="font-bold text-left text-orange-500 dark:text-orange-400 w-full px-4 responsive-title">
            <span className="inline-block animate-blur-in-text whitespace-nowrap-words">
              {greeting.split(' ').map((word, wordIndex) => {
                const wordStartIndex = greeting
                  .split(' ')
                  .slice(0, wordIndex)
                  .join(' ')
                  .length + (wordIndex > 0 ? 1 : 0);
                return (
                <span
                  key={`word-${wordStartIndex}`}
                  className="inline-block mr-2 whitespace-nowrap"
                >
                  {word.split('').map((char, charIndex) => {
                    const globalIndex = wordStartIndex + charIndex;
                    return (
                      <span
                        key={`char-${char}-${globalIndex}-${word}`}
                        className="inline-block animate-blur-in-char"
                        style={{
                          animationDelay: `${globalIndex * 0.015}s`,
                          filter: 'blur(8px)',
                          opacity: 0,
                        }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </span>
                );
              })}
            </span>
          </h2>
        </motion.div>
      </div>
    </div>
  );
}

// Keep the same export name for backward compatibility
export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
