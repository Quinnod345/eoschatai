'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ContextFeedbackProps {
  messageId: string;
  className?: string;
}

/**
 * Context Feedback Component
 * Allows users to rate if the AI's context usage was helpful
 * This data is used to improve RAG effectiveness
 */
export function ContextFeedback({ messageId, className }: ContextFeedbackProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = async (wasHelpful: boolean) => {
    if (isSubmitting || feedback !== null) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/context-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          wasHelpful,
        }),
      });

      if (response.ok) {
        setFeedback(wasHelpful ? 'helpful' : 'not_helpful');
      } else {
        console.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (feedback !== null) {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        Thanks for the feedback!
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => submitFeedback(true)}
        disabled={isSubmitting}
        title="This response was helpful"
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => submitFeedback(false)}
        disabled={isSubmitting}
        title="This response was not helpful"
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
}

