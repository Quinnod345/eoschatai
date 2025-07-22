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
