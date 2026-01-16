'use client';

import { memo } from 'react';
import type { ChatHelpers } from './multimodal-input/types';
import type { VisibilityType } from './visibility-selector';
import React, { useState, useEffect } from 'react';
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
  append: ChatHelpers['append'];
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

  return (
    <div
      data-testid="suggested-actions"
      className="flex flex-col max-w-3xl mx-auto px-4 sm:px-6 animate-fadeIn suggestions-container min-h-screen"
      style={{
        overflow: 'visible',
        minHeight: 'fit-content',
      }}
    >
      {/* Header section - centered container with left-justified text */}
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl">
          <h2 className="font-bold text-left text-orange-500 dark:text-orange-400 w-full px-4 responsive-title">
            <span className="inline-block animate-blur-in-text whitespace-nowrap-words">
              {greeting.split(' ').map((word, wordIndex) => (
                <span
                  key={`word-${word}-${Date.now()}-${wordIndex}`}
                  className="inline-block mr-2 whitespace-nowrap"
                >
                  {word.split('').map((char, charIndex) => {
                    const globalIndex = greeting
                      .split('')
                      .slice(
                        0,
                        greeting.split(' ').slice(0, wordIndex).join(' ')
                          .length +
                          (wordIndex > 0 ? 1 : 0) +
                          charIndex,
                      ).length;
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
              ))}
            </span>
          </h2>
        </div>
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
