'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast-system';
import { cn } from '@/lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  chatId: string;
  voteType: 'up' | 'down';
  onSubmit: (feedback: {
    category?: string;
    description?: string;
  }) => Promise<void>;
}

const feedbackCategories = {
  up: [
    { id: 'accuracy', label: 'Accurate information' },
    { id: 'helpfulness', label: 'Very helpful' },
    { id: 'clarity', label: 'Clear and easy to understand' },
    { id: 'tone', label: 'Perfect tone' },
  ],
  down: [
    { id: 'accuracy', label: 'Inaccurate information' },
    { id: 'helpfulness', label: 'Not helpful' },
    { id: 'clarity', label: 'Confusing or unclear' },
    { id: 'tone', label: 'Wrong tone' },
    { id: 'length', label: 'Too long or too short' },
    { id: 'other', label: 'Other' },
  ],
};

export function FeedbackModal({
  isOpen,
  onClose,
  messageId,
  chatId,
  voteType,
  onSubmit,
}: FeedbackModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        category: selectedCategory || undefined,
        description: description.trim() || undefined,
      });
      toast.success(
        voteType === 'up'
          ? 'Thanks for your positive feedback!'
          : 'Thanks for helping us improve!',
      );
      onClose();
    } catch (error) {
      toast.error('Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({});
      onClose();
    } catch (error) {
      toast.error('Failed to submit vote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = feedbackCategories[voteType];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background rounded-lg shadow-lg z-50"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {voteType === 'up' ? (
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
                      <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                      <ThumbsDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  )}
                  <h2 className="text-lg font-semibold">
                    {voteType === 'up'
                      ? 'What did you like about this response?'
                      : 'What could be improved?'}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Category Selection */}
              <div className="space-y-2 mb-4">
                <p className="text-sm text-muted-foreground">
                  Select a category (optional):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === category.id ? null : category.id,
                        )
                      }
                      className={cn(
                        'px-3 py-2 text-sm rounded-md border transition-colors',
                        selectedCategory === category.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Feedback */}
              <div className="space-y-2 mb-6">
                <label
                  htmlFor="feedback"
                  className="text-sm text-muted-foreground"
                >
                  Additional comments (optional):
                </label>
                <Textarea
                  id="feedback"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    voteType === 'up'
                      ? 'What specifically was helpful?'
                      : 'What specifically could be better?'
                  }
                  className="min-h-[100px] resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                >
                  Skip
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={cn(
                    voteType === 'up'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white',
                  )}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
