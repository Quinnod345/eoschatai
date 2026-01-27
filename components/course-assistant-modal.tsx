'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  BrainIcon,
  CheckIcon,
  LoaderIcon,
  MessageIcon,
} from '@/components/icons';

interface CourseAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseData: {
    personaId: string;
    courseName: string;
    courseDescription: string;
    targetAudience: 'implementer' | 'client';
    syncStatus: 'pending' | 'syncing' | 'complete' | 'failed' | 'not_found';
    isNewActivation: boolean;
    lastSyncedAt: string | null;
    errorMessage?: string;
  };
  courseId: string;
}

export function CourseAssistantModal({
  isOpen,
  onClose,
  courseData,
  courseId,
}: CourseAssistantModalProps) {
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState(courseData.syncStatus);
  const [isActivating, setIsActivating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [processedDocs, setProcessedDocs] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [personaInstructions, setPersonaInstructions] = useState<string | null>(
    null,
  );
  const [showInstructions, setShowInstructions] = useState(false);

  const { data: session } = useSession();
  const isAdmin = session?.user?.email === 'quinn@upaway.dev';

  // Update sync status from courseData when modal opens
  useEffect(() => {
    if (isOpen) {
      setSyncStatus(courseData.syncStatus);
      
      // Fetch persona instructions for admins
      if (isAdmin && courseData.personaId) {
        fetchPersonaInstructions();
      }
    }
  }, [isOpen, courseData.syncStatus, isAdmin, courseData.personaId]);

  const fetchPersonaInstructions = async () => {
    try {
      const response = await fetch(
        `/api/personas/${courseData.personaId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setPersonaInstructions(data.instructions || null);
      }
    } catch (error) {
      console.error('Error fetching persona instructions:', error);
    }
  };

  // Poll for sync status if it's pending or syncing
  useEffect(() => {
    if (!isOpen || (syncStatus !== 'pending' && syncStatus !== 'syncing')) {
      return;
    }

    let pollCount = 0;
    const maxPolls = 120; // Max 6 minutes of polling (120 * 3 seconds)

    const pollInterval = setInterval(async () => {
      pollCount++;

      // Stop polling after max attempts
      if (pollCount >= maxPolls) {
        console.log(
          `[Course Modal] Stopped polling after ${maxPolls} attempts`,
        );
        setSyncStatus('failed');
        clearInterval(pollInterval);
        return;
      }

      try {
        const response = await fetch(
          `/api/circle/sync-course?courseId=${courseId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setSyncStatus(data.syncStatus);
          setProgress(data.progress || 0);
          setStatusMessage(data.statusMessage || '');
          setProcessedDocs(data.processedDocuments || 0);
          setTotalDocs(data.totalDocuments || 0);

          // Stop polling when sync is complete or failed
          if (data.syncStatus === 'complete' || data.syncStatus === 'failed') {
            clearInterval(pollInterval);
          }
        } else if (response.status === 404) {
          // Course not found - stop polling
          console.error('[Course Modal] Course not found, stopping poll');
          clearInterval(pollInterval);
          setSyncStatus('failed');
        }
      } catch (error) {
        console.error('Error polling sync status:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [isOpen, syncStatus, courseId]);

  const handleStartChat = () => {
    setIsActivating(true);
    onClose();
    // Navigate to chat with this persona selected
    router.push(`/chat?personaId=${courseData.personaId}`);
  };

  // Disable button if still syncing, failed, or not found
  const isButtonDisabled =
    isActivating ||
    syncStatus === 'pending' ||
    syncStatus === 'syncing' ||
    syncStatus === 'failed' ||
    syncStatus === 'not_found';

  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'pending':
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 flex items-center gap-1"
          >
            <div className="animate-spin">
              <LoaderIcon size={12} />
            </div>
            Preparing Content
          </Badge>
        );
      case 'syncing':
        return (
          <Badge
            variant="secondary"
            className="bg-blue-500/10 text-blue-600 border-blue-500/20 flex items-center gap-1"
          >
            <div className="animate-spin">
              <LoaderIcon size={12} />
            </div>
            Syncing Course Content
          </Badge>
        );
      case 'complete':
        return (
          <Badge
            variant="secondary"
            className="bg-green-500/10 text-green-600 border-green-500/20 flex items-center gap-1"
          >
            <CheckIcon size={12} />
            Ready
          </Badge>
        );
      case 'failed':
        return (
          <Badge
            variant="secondary"
            className="bg-red-500/10 text-red-600 border-red-500/20"
          >
            Sync Failed
          </Badge>
        );
      case 'not_found':
        return (
          <Badge
            variant="secondary"
            className="bg-orange-500/10 text-orange-600 border-orange-500/20"
          >
            Not Available
          </Badge>
        );
      default:
        return null;
    }
  };

  const getAudienceBadge = () => {
    if (courseData.targetAudience === 'implementer') {
      return (
        <Badge
          variant="secondary"
          className="bg-eos-orange/10 text-eos-orange border-eos-orange/20"
        >
          For Implementers
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="bg-purple-500/10 text-purple-600 border-purple-500/20"
      >
        For Leadership Teams
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <DialogHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-eos-orange to-eos-orangeLight bg-clip-text text-transparent mb-2">
                  {courseData.courseName} Assistant
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  AI-powered course assistant trained on all course content
                </DialogDescription>
              </div>
              <div className="flex flex-col gap-2 items-end">
                {getSyncStatusBadge()}
                {getAudienceBadge()}
              </div>
            </div>
          </DialogHeader>

          <div className="py-6 space-y-6">
            {/* Course Description - only show if not JSON progress data */}
            {courseData.courseDescription &&
              !courseData.courseDescription.startsWith('{') && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    About This Course
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {courseData.courseDescription}
                  </p>
                </div>
              )}

            {/* What the assistant can do */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                What This Assistant Can Do
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="text-green-500 mt-0.5 flex-shrink-0">
                    <CheckIcon size={16} />
                  </div>
                  <span>
                    Answer questions about course content and concepts
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="text-green-500 mt-0.5 flex-shrink-0">
                    <CheckIcon size={16} />
                  </div>
                  <span>
                    Provide guidance on applying course lessons in real
                    situations
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="text-green-500 mt-0.5 flex-shrink-0">
                    <CheckIcon size={16} />
                  </div>
                  <span>
                    {courseData.targetAudience === 'implementer'
                      ? 'Share implementation tips and coaching strategies'
                      : 'Help you understand and use EOS tools effectively'}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="text-green-500 mt-0.5 flex-shrink-0">
                    <CheckIcon size={16} />
                  </div>
                  <span>
                    Reference specific course materials to support your learning
                  </span>
                </li>
              </ul>
            </div>

            {/* Sync Status Message with Progress Bar */}
            {(syncStatus === 'pending' || syncStatus === 'syncing') && (
              <motion.div
                initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="text-blue-500 mt-0.5 flex-shrink-0 animate-spin">
                      <LoaderIcon size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-600 mb-1">
                        {syncStatus === 'pending'
                          ? 'Preparing Course Assistant'
                          : 'Syncing Course Content'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {statusMessage || 'Initializing...'}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {totalDocs > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {processedDocs} of {totalDocs} documents
                        </span>
                        <span className="font-semibold text-blue-600">
                          {progress}%
                        </span>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                        {/* Shimmer effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{
                            x: ['-100%', '200%'],
                          }}
                          transition={{
                            repeat: Number.POSITIVE_INFINITY,
                            duration: 1.5,
                            ease: 'linear',
                          }}
                          style={{ width: '50%' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Estimated time */}
                  {totalDocs > 50 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Large course - this may take 2-3 minutes
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {syncStatus === 'not_found' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-orange-500/5 border-2 border-orange-500/20 rounded-xl p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="text-orange-500 mt-0.5 flex-shrink-0 p-2 bg-orange-500/10 rounded-full">
                    <BrainIcon size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-orange-600 mb-2">
                      Course Not Found in Knowledge Base
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      This course hasn't been synced to our AI knowledge base yet. 
                      The course data needs to be prepared before you can activate the assistant.
                    </p>
                    <div className="bg-orange-500/5 rounded-lg p-4 space-y-2">
                      <p className="text-xs font-semibold text-orange-600">
                        What to do:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Contact your system administrator</li>
                        <li>Or email support@eosworldwide.com</li>
                        <li>Reference Course ID: {courseId}</li>
                      </ul>
                    </div>
                    {courseData.errorMessage && (
                      <p className="text-xs text-muted-foreground mt-3 font-mono bg-muted/30 rounded p-2">
                        Error: {courseData.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {syncStatus === 'failed' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/5 border-2 border-red-500/20 rounded-xl p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="text-red-500 mt-0.5 flex-shrink-0 p-2 bg-red-500/10 rounded-full">
                    <BrainIcon size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-red-600 mb-2">
                      Activation Failed
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      There was an error activating the course assistant. 
                      This could be a temporary issue.
                    </p>
                    <div className="bg-red-500/5 rounded-lg p-4 space-y-2">
                      <p className="text-xs font-semibold text-red-600">
                        Try these steps:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Refresh the page and try again</li>
                        <li>Check your internet connection</li>
                        <li>If the problem persists, contact support@eosworldwide.com</li>
                      </ul>
                    </div>
                    {courseData.errorMessage && (
                      <p className="text-xs text-muted-foreground mt-3 font-mono bg-muted/30 rounded p-2">
                        Error: {courseData.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {syncStatus === 'complete' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl p-6 backdrop-blur-sm"
              >
                <div className="flex items-start gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                    className="text-green-500 flex-shrink-0 p-2 bg-green-500/10 rounded-full"
                  >
                    <CheckIcon size={24} />
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                      Course Assistant Ready!
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your AI assistant has been trained on all course content
                      and is ready to help.
                    </p>
                    {totalDocs > 0 && (
                      <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span>
                          {totalDocs} documents processed and embedded
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Admin: Show AI-Generated Instructions */}
          {isAdmin && personaInstructions && (
            <div className="mt-6 pt-6 border-t border-border">
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex items-center gap-2 text-sm font-medium text-eos-orange hover:text-eos-orangeLight transition-colors mb-3"
              >
                <span>🔧 Admin: View AI-Generated Instructions</span>
                <span
                  className={`transition-transform ${showInstructions ? 'rotate-180' : ''}`}
                >
                  ▼
                </span>
              </button>
              {showInstructions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-muted/30 rounded-lg p-4 overflow-hidden"
                >
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                    {personaInstructions}
                  </pre>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(personaInstructions);
                        alert('Instructions copied to clipboard!');
                      }}
                      className="text-xs px-3 py-1.5 bg-eos-orange text-white rounded hover:bg-eos-orange/90 transition-colors"
                    >
                      Copy Instructions
                    </button>
                    <span className="text-xs text-muted-foreground self-center">
                      {personaInstructions.length} characters
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleStartChat}
              disabled={isButtonDisabled}
              className="bg-gradient-to-r from-eos-orange to-eos-orangeLight hover:from-eos-orange/90 hover:to-eos-orangeLight/90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActivating ? (
                <>
                  <div className="animate-spin">
                    <LoaderIcon size={16} />
                  </div>
                  Opening Chat...
                </>
              ) : syncStatus === 'pending' || syncStatus === 'syncing' ? (
                <>
                  <div className="animate-spin">
                    <LoaderIcon size={16} />
                  </div>
                  Preparing Assistant...
                </>
              ) : syncStatus === 'failed' ? (
                <>Sync Failed - Try Again</>
              ) : (
                <>
                  <MessageIcon size={16} />
                  Start Chat with Assistant
                </>
              )}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
