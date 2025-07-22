import { useState, useCallback } from 'react';

interface ReplyState {
  messageId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp?: Date;
}

export function useReplyState() {
  const [replyState, setReplyState] = useState<ReplyState | null>(null);
  const [isReplying, setIsReplying] = useState(false);

  const startReply = useCallback(
    (messageId: string, content: string, role: 'user' | 'assistant') => {
      setReplyState({
        messageId,
        content,
        role,
        timestamp: new Date(),
      });
      setIsReplying(true);
    },
    [],
  );

  const cancelReply = useCallback(() => {
    setReplyState(null);
    setIsReplying(false);
  }, []);

  const clearReply = useCallback(() => {
    setReplyState(null);
    setIsReplying(false);
  }, []);

  return {
    replyState,
    isReplying,
    startReply,
    cancelReply,
    clearReply,
  };
}
