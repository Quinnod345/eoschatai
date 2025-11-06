'use client';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { useSidebarRefresh } from '@/lib/hooks/use-sidebar-refresh';
import type { UIMessage } from 'ai';
import type { VisibilityType } from '@/components/visibility-selector';
import type { ResearchMode } from '@/components/nexus-research-selector';
import type { Session } from 'next-auth';
import { useEffect, useState, useCallback } from 'react';
import { generateUUID } from '@/lib/utils';
import { useLoading } from '@/hooks/use-loading';
import { toast } from 'sonner';

interface ChatClientWrapperProps {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialProvider: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session | null;
  autoResume: boolean;
  initialPersonaId?: string;
  initialProfileId?: string;
  initialResearchMode: ResearchMode;
  courseActivationParams?: {
    courseActivated: boolean;
    courseName?: string;
    error?: string;
    errorMessage?: string;
    courseId?: string;
  };
  documentContext?: {
    type: 'ai-document' | 'user-document';
    id: string;
    title: string;
    message: string;
  } | null;
}

export function ChatClientWrapper({
  id,
  initialMessages,
  initialChatModel,
  initialProvider,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
  initialPersonaId,
  initialProfileId,
  initialResearchMode,
  courseActivationParams,
  documentContext,
}: ChatClientWrapperProps) {
  // Ensure sidebar is refreshed when viewing this chat
  useSidebarRefresh(id);

  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [meetingMetadata, setMeetingMetadata] = useState<any>(null);
  const { setLoading } = useLoading();

  // Hide loading state when component mounts (chat is ready)
  useEffect(() => {
    // Clear any loading state immediately
    setLoading(false);
    
    // Also clear it after a short delay to ensure it's gone
    const timer = setTimeout(() => {
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [setLoading]);

  // Handle course activation notifications
  useEffect(() => {
    if (!courseActivationParams) return;

    // Only show success if explicitly activated (not on normal page load)
    if (
      courseActivationParams.courseActivated && 
      courseActivationParams.courseName && 
      !courseActivationParams.error
    ) {
      toast.success('Course Assistant Activated!', {
        description: `${courseActivationParams.courseName} assistant is ready. You can now ask questions about the course content.`,
        duration: 5000,
      });
    }

    // Show error toast for course not found
    if (courseActivationParams.error === 'course_not_found') {
      toast.error('Course Not Found', {
        description: `The course "${courseActivationParams.courseName || 'Unknown'}" hasn't been synced yet. Contact your administrator to sync course ID ${courseActivationParams.courseId}.`,
        duration: 8000,
      });
    }

    // Show error toast for activation failure
    if (courseActivationParams.error === 'activation_failed') {
      toast.error('Activation Failed', {
        description: courseActivationParams.errorMessage || 'There was an error activating the course assistant. Please try again.',
        duration: 6000,
      });
    }
  }, [courseActivationParams]);

  // Check for pending recording message
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pendingMessageData = sessionStorage.getItem(
        'pendingRecordingMessage',
      );
      if (pendingMessageData) {
        try {
          const messageData = JSON.parse(pendingMessageData);
          sessionStorage.removeItem('pendingRecordingMessage');

          // Only set pending message if it should be auto-sent
          if (messageData.shouldAutoSend) {
            setPendingMessage(messageData.content);
            // Store meeting metadata if available
            if (messageData.meetingMetadata) {
              setMeetingMetadata(messageData.meetingMetadata);
            }
          }
        } catch (error) {
          console.error('Error processing pending recording message:', error);
        }
      }
    }
  }, []);

  // Clear pending message after it's been processed
  const clearPendingMessage = useCallback(() => {
    setPendingMessage(null);
    setMeetingMetadata(null);
  }, []);

  return (
    <>
      {session && (
        <Chat
          id={id}
          initialMessages={initialMessages}
          initialChatModel={initialChatModel}
          initialProvider={initialProvider}
          initialVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
          autoResume={autoResume}
          initialPersonaId={initialPersonaId}
          initialProfileId={initialProfileId}
          initialResearchMode={initialResearchMode}
          pendingMessage={pendingMessage}
          documentContext={documentContext}
          onPendingMessageSent={clearPendingMessage}
          meetingMetadata={meetingMetadata}
        />
      )}
      <DataStreamHandler id={id} />
    </>
  );
}
