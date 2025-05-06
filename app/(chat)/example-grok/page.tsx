'use client';

import { useEffect, useState } from 'react';
import { useChat } from 'ai/react';

export default function ExampleGrokPage() {
  const { messages, isLoading, error } = useChat({
    api: '/api/example',
    initialMessages: [
      {
        id: 'initial',
        role: 'assistant',
        content: 'Loading...'
      }
    ],
  });

  return (
    <div className="flex flex-col min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Example Grok Model Response</h1>
      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
        {error ? (
          <p className="text-red-500">Error: {error.message}</p>
        ) : (
          <div>
            {messages.map((message) => (
              <div key={message.id} className="mb-4">
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            {isLoading && <div className="animate-pulse">Loading...</div>}
          </div>
        )}
      </div>
    </div>
  );
} 