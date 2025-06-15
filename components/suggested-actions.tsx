'use client';

import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import React, { useState, useEffect } from 'react';
import '../styles/animations.css';

// Time-based greeting options - conversational and warm
const MORNING_GREETINGS = [
  "Good morning! I'm ready to help with your EOS journey.",
  'Rise and shine! Ready to tackle some EOS challenges together?',
  'Morning! How can I support your business today?',
  'Good morning! What would you like to explore about EOS?',
];

const AFTERNOON_GREETINGS = [
  'Good afternoon! How can I help with your EOS implementation?',
  'Hope your day is going well! What can I assist you with?',
  'Good afternoon! What EOS topic would you like to explore?',
  'Afternoon! How can I support your business growth?',
];

const EVENING_GREETINGS = [
  'Good evening! What EOS topics would you like to explore?',
  'Evening! How can I help with your business planning?',
  'Good evening! Ready to work on your EOS implementation?',
  'Evening! What can I assist you with today?',
];

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  append,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const [greeting, setGreeting] = useState('');

  // Set time-appropriate random greeting
  useEffect(() => {
    const getRandomGreeting = () => {
      const date = new Date();
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
      className="flex items-center justify-center min-h-[50vh] w-full p-4"
      style={{
        // Ensure we take up appropriate space but don't cause overflow
        minHeight: 'max(50vh, 300px)',
        maxHeight: '80vh',
      }}
    >
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="font-bold text-orange-500 dark:text-orange-400 animate-blur-in-text">
          <span
            className="inline-block text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-tight"
            style={{
              // Responsive text sizing based on viewport
              fontSize: 'clamp(1.5rem, 4vw + 1rem, 4rem)',
              lineHeight: '1.2',
            }}
          >
            {greeting.split(' ').map((word) => (
              <span
                key={`word-${word}-${Math.random()}`}
                className="inline-block mr-2 sm:mr-3 whitespace-nowrap"
              >
                {word.split('').map((char) => {
                  const uniqueKey = `char-${word}-${char}-${Math.random()}`;
                  return (
                    <span
                      key={uniqueKey}
                      className="inline-block animate-blur-in-char"
                      style={{
                        animationDelay: '0.5s',
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
        </h1>

        {/* Subtle subtitle that's responsive */}
        <p
          className="text-muted-foreground mt-4 sm:mt-6 md:mt-8 animate-fadeIn opacity-70"
          style={{
            fontSize: 'clamp(0.875rem, 2vw + 0.5rem, 1.125rem)',
            animationDelay: '1s',
            animationFillMode: 'both',
          }}
        >
          Your AI assistant for EOS implementation
        </p>
      </div>
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
