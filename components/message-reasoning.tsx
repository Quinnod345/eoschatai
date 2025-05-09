'use client';

import { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronRightIcon, LoaderIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Markdown } from './markdown';

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
  provider?: string;
}

export function MessageReasoning({
  isLoading,
  reasoning,
  provider = 'xai',
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Process reasoning to clean up <think> tags for display and extract brief summary
  const { cleanedReasoning, summary } = useMemo(() => {
    // Remove <think> and </think> tags for cleaner display
    let processed = reasoning;

    if (processed.includes('<think>')) {
      processed = processed.replace(/<\/?think>/g, '');
    }

    // Extract topic from content, focusing on what's being analyzed rather than process description
    const extractTopicFromText = (inputText: string): string => {
      // Remove phrases like "the user is asking", "the user wants", etc.
      let cleanedText = inputText.replace(
        /the user (is|wants|needs|asks|requested|inquired|mentioned).+?(?=about|for|to|\.|\n)/gi,
        '',
      );

      // Clean up other common prefixes that don't add value to the summary
      cleanedText = cleanedText.replace(
        /(I need to|I should|I will|I'll|I'm going to|Let me|I can)/gi,
        '',
      );

      // Limit length and add ellipsis if needed
      if (cleanedText.length > 25) {
        return `${cleanedText.substring(0, 25).trim()}...`;
      }
      return cleanedText.trim();
    };

    // Generate a concise topic-focused summary
    let briefSummary = 'analyzing query';

    // Look for meaningful content patterns
    if (processed.match(/\btopic\b[:\s]+([^.]{3,30})/i)) {
      // Extract direct topic mentions
      const topicMatch = processed.match(/\btopic\b[:\s]+([^.]{3,30})/i);
      if (topicMatch?.[1]) {
        briefSummary = extractTopicFromText(topicMatch[1]);
      }
    } else if (processed.match(/\bconcept\b[:\s]+([^.]{3,30})/i)) {
      // Extract concept mentions
      const conceptMatch = processed.match(/\bconcept\b[:\s]+([^.]{3,30})/i);
      if (conceptMatch?.[1]) {
        briefSummary = extractTopicFromText(conceptMatch[1]);
      }
    } else if (processed.match(/\babout\b\s+([^.]{3,40})/i)) {
      // Extract "about X" patterns
      const aboutMatch = processed.match(/\babout\b\s+([^.]{3,40})/i);
      if (aboutMatch?.[1]) {
        briefSummary = extractTopicFromText(aboutMatch[1]);
      }
    } else if (processed.includes('First, ')) {
      // Extract a few words after "First, "
      const firstMatch = processed.match(/First,\s+([^.]{5,40})/i);
      if (firstMatch?.[1]) {
        briefSummary = extractTopicFromText(firstMatch[1]);
      }
    } else if (processed.match(/\bgoal\b[:\s]+([^.]{3,40})/i)) {
      // Extract goal statements
      const goalMatch = processed.match(/\bgoal\b[:\s]+([^.]{3,40})/i);
      if (goalMatch?.[1]) {
        briefSummary = extractTopicFromText(goalMatch[1]);
      }
    } else if (processed.match(/\bquestion\b[:\s]+([^.]{3,40})/i)) {
      // Extract question statements
      const questionMatch = processed.match(/\bquestion\b[:\s]+([^.]{3,40})/i);
      if (questionMatch?.[1]) {
        briefSummary = extractTopicFromText(questionMatch[1]);
      }
    } else if (processed.includes('analyzing')) {
      // Extract analyzing patterns
      const analyzingMatch = processed.match(/analyzing\s+([^.]{3,40})/i);
      if (analyzingMatch?.[1]) {
        briefSummary = extractTopicFromText(analyzingMatch[1]);
      }
    } else if (processed.includes('understanding')) {
      // Extract understanding patterns
      const understandMatch = processed.match(/understanding\s+([^.]{3,40})/i);
      if (understandMatch?.[1]) {
        briefSummary = extractTopicFromText(understandMatch[1]);
      }
    } else {
      // Try to extract a reasonable portion from the first paragraph
      const firstPara = processed.split('\n')[0];
      if (firstPara && firstPara.length > 10) {
        const cleanedPara = extractTopicFromText(firstPara.substring(0, 40));
        if (cleanedPara && cleanedPara.length > 3) {
          briefSummary = cleanedPara;
        }
      }
    }

    return {
      cleanedReasoning: processed.trim(),
      summary: briefSummary,
    };
  }, [reasoning]);

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: 'auto',
      opacity: 1,
      marginTop: '1rem',
      marginBottom: '0.5rem',
    },
  };

  const modelName = provider === 'xai' ? 'Grok' : 'OpenAI';

  return (
    <div className="flex flex-col mb-4">
      {isLoading ? (
        <div className="flex flex-row gap-2 items-center">
          <div className="font-medium">{modelName} Reasoning</div>
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        </div>
      ) : (
        <div
          className="flex flex-row gap-2 items-center cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/20 p-1 rounded-md transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <span className="text-amber-600 dark:text-amber-400">
              <ChevronDownIcon size={20} />
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              <ChevronRightIcon size={20} />
            </span>
          )}
          <div className="font-medium text-amber-600 dark:text-amber-400">
            {modelName} reasoning:{' '}
            <span className="text-zinc-600 dark:text-zinc-400 font-normal">
              {summary}
            </span>
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className="pl-4 text-zinc-600 dark:text-zinc-400 border-l border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 rounded-md p-3 flex flex-col gap-4"
          >
            <Markdown>{cleanedReasoning}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
