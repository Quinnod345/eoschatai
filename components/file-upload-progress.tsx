'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Upload,
  FileIcon,
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import type { UploadProgress } from '@/hooks/use-file-upload';
import { cn, formatFileSize } from '@/lib/utils';

interface FileUploadProgressProps {
  uploads: UploadProgress[];
  onCancel: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onClearCompleted?: () => void;
  className?: string;
}

export function FileUploadProgress({
  uploads,
  onCancel,
  onRetry,
  onClearCompleted,
  className,
}: FileUploadProgressProps) {
  if (uploads.length === 0) return null;

  const hasCompleted = uploads.some((upload) => upload.status === 'completed');
  const hasErrors = uploads.some((upload) => upload.status === 'error');

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-hidden',
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="bg-background border rounded-lg shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Uploading {uploads.length} file{uploads.length > 1 ? 's' : ''}
            </span>
          </div>
          {hasCompleted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCompleted}
              className="h-7 text-xs"
            >
              Clear completed
            </Button>
          )}
        </div>

        {/* Upload list */}
        <div className="max-h-80 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {uploads.map((upload) => (
              <motion.div
                key={upload.fileId}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b last:border-0"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {upload.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : upload.status === 'error' ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate pr-2">
                          {upload.fileName}
                        </p>
                        <div className="flex items-center gap-1">
                          {upload.status === 'error' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRetry(upload.fileId)}
                              className="h-6 w-6 p-0"
                              title="Retry upload"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          {(upload.status === 'uploading' ||
                            upload.status === 'pending') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onCancel(upload.fileId)}
                              className="h-6 w-6 p-0"
                              title="Cancel upload"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* File size and progress info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span>
                          {formatFileSize(upload.uploadedSize)} /{' '}
                          {formatFileSize(upload.size)}
                        </span>
                        {upload.retryCount > 0 && (
                          <span className="text-amber-600">
                            (Retry {upload.retryCount})
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {(upload.status === 'uploading' ||
                        upload.status === 'processing') && (
                        <div className="space-y-1">
                          <Progress value={upload.progress} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">
                            {upload.status === 'processing'
                              ? 'Processing...'
                              : `${Math.round(upload.progress)}%`}
                          </p>
                        </div>
                      )}

                      {/* Error message */}
                      {upload.status === 'error' && upload.error && (
                        <p className="text-xs text-destructive mt-1">
                          {upload.error}
                        </p>
                      )}

                      {/* Success message */}
                      {upload.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-1">
                          Upload complete
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
