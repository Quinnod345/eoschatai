import React from 'react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-muted-foreground/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">
          Loading chat...
        </p>
      </div>
    </div>
  );
}
 