import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mic, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioTranscriptCardProps {
  name: string;
  transcript?: string;
  duration?: number;
  status?: 'processing' | 'ready' | 'error';
  error?: string;
  isUserMessage?: boolean;
}

export function AudioTranscriptCard({
  name,
  transcript,
  duration,
  status = 'ready',
  error,
  isUserMessage = true,
}: AudioTranscriptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasContent = status === 'ready' && transcript;

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isUserMessage
          ? 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800'
          : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 border-gray-200 dark:border-gray-700',
        hasContent && 'cursor-pointer hover:shadow-md',
      )}
      onClick={() => hasContent && setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2 rounded-lg flex-shrink-0',
              status === 'error'
                ? 'bg-red-100 dark:bg-red-900/50'
                : isUserMessage
                  ? 'bg-purple-100 dark:bg-purple-900/50'
                  : 'bg-gray-100 dark:bg-gray-800/50',
            )}
          >
            {status === 'error' ? (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <Mic
                className={cn(
                  'h-5 w-5',
                  isUserMessage
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-600 dark:text-gray-400',
                )}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4
                className={cn(
                  'font-medium text-sm truncate',
                  status === 'error'
                    ? 'text-red-900 dark:text-red-100'
                    : isUserMessage
                      ? 'text-purple-900 dark:text-purple-100'
                      : 'text-gray-900 dark:text-gray-100',
                )}
              >
                {name}
              </h4>
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs',
                  status === 'error'
                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    : status === 'processing'
                      ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                      : isUserMessage
                        ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300',
                )}
              >
                <Mic className="h-3 w-3 mr-1" />
                {status === 'error'
                  ? 'Failed'
                  : status === 'processing'
                    ? 'Processing'
                    : 'Audio'}
              </Badge>
            </div>

            {duration && duration > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(duration)}</span>
              </div>
            )}

            {status === 'error' && error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-md p-3 border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            {status === 'processing' && (
              <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 rounded-md p-3 border border-yellow-200 dark:border-yellow-800">
                Transcribing audio... This may take a moment.
              </div>
            )}

            {hasContent && (
              <>
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Transcript available</span>
                  {transcript && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Show
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {isExpanded && transcript && (
                  <div className="mt-3 bg-white/70 dark:bg-gray-900/50 rounded-md p-3 border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
                    <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {transcript}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




