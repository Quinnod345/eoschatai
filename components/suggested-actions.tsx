'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import React, { useState, useEffect } from 'react';
import '../styles/animations.css';

// Conversation starters organized by category
const CONVERSATION_STARTERS = [
  {
    category: '🧠 EOS Model & Tools',
    starters: [
      'What are the Six Key Components® of EOS?',
      'How do I fill out a Vision/Traction Organizer™?',
      'What should go in the "Core Focus™" section of our V/TO™?',
      'Can you help me create an Accountability Chart™?',
      "What's the difference between Rocks and To-Dos?",
      'How does the Issues Solving Track™ (IDS) work?',
      "What's a good example of a measurable for my Scorecard?",
      'How do I structure a Level 10 Meeting™ agenda?',
      'What are the best measurables for a sales team?',
      'What do the terms "right person, right seat" really mean?',
    ],
  },
  {
    category: '🚀 Implementation & Coaching',
    starters: [
      'How do I start implementing EOS in my company?',
      'What should we do in our first 90 days of EOS?',
      "How do I know if I'm ready for a Professional EOS Implementer™?",
      'Can you walk me through the 90 Minute Meeting™ agenda?',
      "What's the best way to cascade the Vision to the team?",
    ],
  },
  {
    category: '🧰 People Tools',
    starters: [
      'How do I use the People Analyzer™?',
      'What does GWC™ mean and how do I use it?',
      'Can you help me conduct a 5-5-5™ conversation?',
      "What's the LMA™ concept in EOS?",
      "What if someone doesn't fit our Core Values?",
    ],
  },
  {
    category: '📊 Data & Scorecards',
    starters: [
      'How do I build a 13-week Scorecard?',
      "What's a good Scorecard for an operations team?",
      'Can you help me track our Rocks more effectively?',
      'What is the difference between a Rock and a KPI?',
      'How should I review Scorecard numbers in a Level 10?',
    ],
  },
  {
    category: '🗓️ Meetings & Cadence',
    starters: [
      'What is a Weekly Level 10 Meeting™?',
      'How long should a Level 10 take?',
      "What's the EOS Meeting Pulse™?",
      'What should go on our Issues List?',
      'Can you help me prepare for our Quarterly Session?',
    ],
  },
  {
    category: '📘 EOS Books & Philosophy',
    starters: [
      'What book should I start with in the Traction Library?',
      'What is EOS Life®?',
      'How is Get A Grip different from Traction?',
      "What's the Visionary-Integrator™ relationship?",
      'What does "delegate and elevate" mean in EOS?',
    ],
  },
  {
    category: '💡 Leadership, Culture & EOS Life®',
    starters: [
      'How do I know if someone is a Visionary or Integrator?',
      'Can you help me clarify our 10-Year Target™?',
      'What are some sample Core Values from other companies?',
      'How do I introduce EOS to my leadership team?',
      'How can EOS help us run a healthier business?',
    ],
  },
];

// Time-based greeting options with emojis
const MORNING_GREETINGS = [
  '☀️ Good morning! What can I help with today?',
  '🌅 Rise and shine! Ready to boost your EOS journey?',
  '🌞 Morning! What EOS questions are on your mind?',
  '🍳 Early bird gets the ROCKs done! How can I assist?',
  "☕ Coffee in hand? Let's tackle some EOS challenges!",
];

const AFTERNOON_GREETINGS = [
  '🌤️ Good afternoon! What EOS topic interests you?',
  '⚡ Midday motivation! What would you like to learn?',
  '🚀 Afternoon boost! What can I clarify about EOS?',
  "💼 Back from lunch? Let's get some EOS work done!",
  "🌻 Afternoon! What's your EOS focus right now?",
];

const EVENING_GREETINGS = [
  '🌙 Good evening! What EOS topics shall we explore?',
  "✨ Evening reflection time! What's on your EOS mind?",
  '🌆 Wrapping up your day! Let me help with EOS!',
  '🔮 Evening inspiration! What EOS challenge are you facing?',
  '🌟 Night owls get things done! What EOS questions do you have?',
];

// Define type for conversation starter category
interface ConversationStarterCategory {
  category: string;
  starters: string[];
  randomStarters?: string[];
}

// Keep the original interface for backward compatibility
interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
  selectedVisibilityType: VisibilityType;
}

// Replace old implementation with new functionality
function PureSuggestedActions({
  chatId,
  append,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [animateOut, setAnimateOut] = useState(false);
  const [displayedCategory, setDisplayedCategory] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [randomizedStarters, setRandomizedStarters] = useState<
    ConversationStarterCategory[]
  >([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  // Randomize starters for each category
  useEffect(() => {
    // Function to get 4 random items from an array
    const getRandomItems = (array: string[], count = 4) => {
      // Clone the array to avoid modifying the original
      const shuffled = [...array];

      // Fisher-Yates shuffle algorithm
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Return the first 'count' items or all if fewer
      return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    // Create randomized versions of each category's starters
    const randomized = CONVERSATION_STARTERS.map((category) => ({
      ...category,
      randomStarters: getRandomItems(
        category.starters,
        typeof window !== 'undefined' && window.innerWidth < 768 ? 3 : 4,
      ), // Fewer items on mobile
    }));

    setRandomizedStarters(randomized);
  }, []); // Only run once on mount

  // Handle category change with animation
  const handleCategoryChange = (index: number) => {
    if (index === activeCategory) return;
    setAnimateOut(true);
    setDropdownOpen(false);

    // Increase timeout to allow animation to complete smoothly
    setTimeout(() => {
      setDisplayedCategory(index);
      setActiveCategory(index);

      // Small delay before starting the fade-in animation
      // This prevents visual glitches during the transition
      requestAnimationFrame(() => {
        setTimeout(() => {
          setAnimateOut(false);
        }, 50);
      });
    }, 400); // Increased from 300ms to 400ms for smoother transition
  };

  // Handle dropdown toggle
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Handle starter click with the original append functionality
  const handleStarterClick = (starter: string) => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    append({
      role: 'user',
      content: starter,
    });
  };

  return (
    <div
      data-testid="suggested-actions"
      className="flex flex-col max-w-3xl mx-auto px-2 animate-fadeIn"
    >
      {/* Header section */}
      <div className="flex flex-col items-center justify-center mb-6 md:mb-12 pt-4 md:pt-8">
        <h2
          className="text-xl md:text-3xl font-semibold text-center text-orange-500 dark:text-orange-400 mb-6 md:mb-12 animate-slideDown"
          style={{ textShadow: '0 0 10px rgba(249, 115, 22, 0.4)' }}
        >
          {greeting}
        </h2>

        {/* Visual separator */}
        <div className="w-full max-w-md mx-auto mb-6 md:mb-12">
          <hr
            className="border-none h-[3px] bg-gray-300 opacity-70 dark:bg-gray-700 dark:opacity-50"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(209, 213, 219, 0.5) 50%, transparent 50%)',
              backgroundSize: '15px 3px',
            }}
          />
        </div>

        {/* Mobile Dropdown */}
        <div className="md:hidden w-full max-w-sm mx-auto mb-4 animate-slideUp relative z-30">
          <div className="relative">
            <button
              type="button"
              onClick={toggleDropdown}
              className="w-full flex items-center justify-between px-4 py-2 rounded-modern bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-modern-dark dark:text-gray-100"
            >
              <span>
                {randomizedStarters[activeCategory]?.category ||
                  'Select a category'}
              </span>
              <svg
                className={`ml-2 h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform duration-300 ${dropdownOpen ? 'transform rotate-180' : ''}`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-modern shadow-lg dark:shadow-modern-dark border border-gray-200 dark:border-gray-700 animate-fadeIn max-h-60 overflow-auto">
                {randomizedStarters.map((category, index) => (
                  <button
                    key={`category-${category.category}-${index}`}
                    type="button"
                    onClick={() => handleCategoryChange(index)}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      activeCategory === index
                        ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {category.category}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Category Tabs */}
        <div className="hidden md:flex flex-wrap gap-2 justify-center animate-slideUp">
          {randomizedStarters.map((category, index) => (
            <button
              key={`desktop-category-${category.category}-${index}`}
              type="button"
              onClick={() => handleCategoryChange(index)}
              className={`px-4 py-2 rounded-modern text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                activeCategory === index
                  ? 'bg-orange-500 dark:bg-orange-600 text-white shadow-modern shadow-orange-500/50 dark:shadow-orange-600/30'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-500 dark:hover:text-orange-400 border border-gray-100 dark:border-gray-700'
              }`}
            >
              {category.category}
            </button>
          ))}
        </div>
      </div>

      {/* Starters Grid - More compact on mobile */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-all duration-300 ease-in-out ${
          animateOut ? 'opacity-0' : 'opacity-100'
        } relative z-10`}
        style={{
          minHeight: '220px', // Ensure consistent height during transitions
          willChange: 'opacity, transform', // Optimize for animations
        }}
      >
        {randomizedStarters[displayedCategory]?.randomStarters?.map(
          (starter, index) => (
            <motion.button
              key={`starter-${index}-${starter.substring(0, 10)}`}
              type="button"
              onClick={() => handleStarterClick(starter)}
              className={`bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-2 md:p-4 rounded-modern shadow-sm md:shadow-modern dark:shadow-modern-dark hover:shadow-card dark:hover:shadow-card-dark border border-gray-100 dark:border-gray-700 text-left transition-all duration-300 transform hover:scale-102 hover:border-orange-200 dark:hover:border-orange-700 animate-scaleIn ${`stagger-${(index % 4) + 1}`}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: index * 0.1,
                type: 'spring',
                stiffness: 260,
                damping: 20,
              }}
              style={{
                willChange: 'transform',
                height: '100%',
              }}
            >
              <p className="text-gray-800 dark:text-gray-200 text-sm md:text-base">
                {starter}
              </p>
            </motion.button>
          ),
        )}
      </div>

      {/* Custom Prompt Section */}
      <div className="mt-4 md:mt-8 text-center animate-fadeIn relative z-10">
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
          Or type your own question below
        </p>
        <div className="flex items-center justify-center">
          <svg
            className="h-4 w-4 md:h-5 md:w-5 text-orange-500 dark:text-orange-400 mr-2 animate-bounce-slow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
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
