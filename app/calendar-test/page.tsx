'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

// Helper to extract text from message parts (AI SDK 5)
function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && !!p.text)
    .map((p) => p.text)
    .join('');
}

export default function CalendarTestPage() {
  const [input, setInput] = useState('');
  const {
    messages,
    sendMessage,
    status
  } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  
  const isLoading = status === 'streaming' || status === 'submitted';

  const askAboutCalendar = () => {
    sendMessage({ text: 'What events do I have scheduled for tomorrow?' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Calendar AI Integration Test</h1>

      <div className="mb-6">
        <button
          onClick={askAboutCalendar}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-4"
          type="button"
        >
          Ask About Tomorrow&apos;s Events
        </button>
      </div>

      <div className="border rounded-lg p-4 mb-6">
        <form
          id="chat-form"
          onSubmit={handleSubmit}
          className="flex flex-col space-y-4"
        >
          <div className="flex">
            <input
              className="flex-1 p-2 border rounded mr-2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your calendar..."
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? 'Thinking...' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Conversation</h2>
        <div className="space-y-4">
          {messages.map((message) => {
            const messageText = getMessageText(message);
            return (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-100 ml-8'
                    : 'bg-gray-100 mr-8'
                }`}
              >
                <p className="text-sm font-semibold mb-1">
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </p>
                <div className="whitespace-pre-wrap">{messageText}</div>

                {message.role === 'assistant' &&
                  messageText.includes('error') && (
                    <div className="mt-2 border-t pt-2 text-red-500 text-sm">
                      Possible error detected in response. Try the debugging page:{' '}
                      <a href="/calendar-debug" className="underline">
                        Calendar Debug
                      </a>
                    </div>
                  )}
              </div>
            );
          })}

          {messages.length === 0 && (
            <p className="text-gray-500 italic">
              No messages yet. Ask a question about your calendar.
            </p>
          )}

          {isLoading && (
            <div className="p-3 rounded-lg bg-gray-100 mr-8 animate-pulse">
              Thinking...
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-600">
        <p>
          Not working? Try the{' '}
          <a href="/calendar-debug" className="text-blue-500 underline">
            debugging page
          </a>{' '}
          to diagnose issues.
        </p>
      </div>
    </div>
  );
}
