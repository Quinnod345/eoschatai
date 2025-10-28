'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    syncStatus: 'pending' | 'syncing' | 'complete' | 'failed';
    isNewActivation: boolean;
    lastSyncedAt: string | null;
  };
}

export function CourseAssistantModal({
  isOpen,
  onClose,
  courseData,
}: CourseAssistantModalProps) {
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState(courseData.syncStatus);
  const [isActivating, setIsActivating] = useState(false);

  // Poll for sync status if it's pending or syncing
  useEffect(() => {
    if (!isOpen || (syncStatus !== 'pending' && syncStatus !== 'syncing')) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/circle/sync-course?courseId=${courseData.personaId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setSyncStatus(data.syncStatus);

          // Stop polling when sync is complete or failed
          if (data.syncStatus === 'complete' || data.syncStatus === 'failed') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Error polling sync status:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [isOpen, syncStatus, courseData.personaId]);

  const handleStartChat = () => {
    setIsActivating(true);
    // Navigate to chat with this persona selected
    router.push(`/chat?personaId=${courseData.personaId}`);
  };

  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'pending':
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
          >
            <span className="mr-1 inline-block animate-spin">
              <LoaderIcon size={12} />
            </span>
            Preparing Content
          </Badge>
        );
      case 'syncing':
        return (
          <Badge
            variant="secondary"
            className="bg-blue-500/10 text-blue-600 border-blue-500/20"
          >
            <span className="mr-1 inline-block animate-spin">
              <LoaderIcon size={12} />
            </span>
            Syncing Course Content
          </Badge>
        );
      case 'complete':
        return (
          <Badge
            variant="secondary"
            className="bg-green-500/10 text-green-600 border-green-500/20"
          >
            <span className="mr-1 inline-block">
              <CheckIcon size={12} />
            </span>
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
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-md border-2 border-border/50">
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
            {/* Course Description */}
            {courseData.courseDescription && (
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
                  <span className="mt-0.5 flex-shrink-0 text-green-500">
                    <CheckIcon size={16} />
                  </span>
                  <span>Answer questions about course content and concepts</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 flex-shrink-0 text-green-500">
                    <CheckIcon size={16} />
                  </span>
                  <span>
                    Provide guidance on applying course lessons in real
                    situations
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 flex-shrink-0 text-green-500">
                    <CheckIcon size={16} />
                  </span>
                  <span>
                    {courseData.targetAudience === 'implementer'
                      ? 'Share implementation tips and coaching strategies'
                      : 'Help you understand and use EOS tools effectively'}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 flex-shrink-0 text-green-500">
                    <CheckIcon size={16} />
                  </span>
                  <span>
                    Reference specific course materials to support your learning
                  </span>
                </li>
              </ul>
            </div>

            {/* Sync Status Message */}
            {syncStatus === 'syncing' && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-blue-500 animate-spin">
                    <LoaderIcon size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      Syncing Course Content
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The assistant is learning from all the course materials.
                      This usually takes 30-60 seconds.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {syncStatus === 'failed' && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-red-500">
                    <BrainIcon size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-red-600">
                      Sync Failed
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      There was an error syncing the course content. You can
                      still use the assistant, but it may not have access to all
                      course materials.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {syncStatus === 'complete' && courseData.isNewActivation && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-green-500">
                    <CheckIcon size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      Course Assistant Ready!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your course assistant has been activated and trained on all
                      course content. You can start chatting now.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleStartChat}
              disabled={isActivating}
              className="bg-gradient-to-r from-eos-orange to-eos-orangeLight hover:from-eos-orange/90 hover:to-eos-orangeLight/90"
            >
              {isActivating ? (
                <>
                  <span className="mr-2 inline-block animate-spin">
                    <LoaderIcon size={16} />
                  </span>
                  Loading...
                </>
              ) : (
                <>
                  <MessageIcon size={16} />
                  <span className="ml-2">Start Chat with Assistant</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}


