/**
 * Firesearch Follow-up Questions Component
 * Displays and handles follow-up questions from deep research
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FiresearchFollowUpQuestionsProps {
  questions: string[];
  onQuestionSelect: (question: string) => void;
  onRefresh?: () => void;
  className?: string;
}

export function FiresearchFollowUpQuestions({
  questions,
  onQuestionSelect,
  onRefresh,
  className,
}: FiresearchFollowUpQuestionsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn(
        'mt-0 border-purple-200 dark:border-purple-900 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-950/70',
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Suggested Follow-up Questions</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-8 w-8 p-0"
                title="Generate new questions"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  isExpanded && 'rotate-90',
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 pb-3">
          <div className="space-y-2">
            {questions.map((question, index) => (
              <button
                key={`followup-${index}-${question
                  .slice(0, 50)
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')}`}
                type="button"
                onClick={() => {
                  setSelectedIndex(index);
                  onQuestionSelect(question);
                }}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-all',
                  'hover:bg-purple-50 dark:hover:bg-purple-950',
                  'border border-transparent hover:border-purple-200 dark:hover:border-purple-800',
                  'group relative',
                  selectedIndex === index &&
                    'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-purple-600 dark:text-purple-400 font-medium text-sm mt-0.5">
                    {index + 1}.
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 leading-relaxed">
                    {question}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mt-0.5" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Click any question to continue your research deeper
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
