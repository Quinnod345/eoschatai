'use client';

import { Reply, User, Bot } from 'lucide-react';

interface ReplyContextProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ReplyContext({ role, content }: ReplyContextProps) {
  const isUser = role === 'user';

  return (
    <div className="mb-3 p-3 rounded-lg border border-border/50 bg-muted/30 backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <Reply className="h-3 w-3" />
          <span>Replying to:</span>
          {isUser ? (
            <>
              <User className="h-3 w-3" />
              <span>You</span>
            </>
          ) : (
            <>
              <Bot className="h-3 w-3" />
              <span>Assistant</span>
            </>
          )}
        </div>
      </div>
      <div className="pl-5 border-l-2 border-primary/30 ml-1">
        <p className="text-sm text-muted-foreground/80 italic line-clamp-3">
          {content}
        </p>
      </div>
    </div>
  );
}
