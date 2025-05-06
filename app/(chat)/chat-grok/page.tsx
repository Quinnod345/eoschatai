'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';

export default function ChatGrokPage() {
  const [prompt, setPrompt] = useState('');
  
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat-grok',
    onFinish: () => {
      // Optionally do something when the response is complete
    },
  });

  return (
    <div className="flex flex-col min-h-screen p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chat with Grok</h1>
      
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Send a message to start a conversation with Grok
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`p-4 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-100 dark:bg-blue-900 ml-auto max-w-[80%]' 
                  : 'bg-gray-100 dark:bg-gray-800 mr-auto max-w-[80%]'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse mr-auto max-w-[80%]">
            Thinking...
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask Grok something..."
          className="flex-1 p-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
} 