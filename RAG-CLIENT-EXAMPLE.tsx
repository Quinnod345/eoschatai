'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';

export default function RagChatExample() {
  const [isIndexing, setIsIndexing] = useState(false);

  // Use the RAG-enabled chat endpoint
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: '/api/chat-rag',
      // Optional but recommended - initialize with a chat ID if available
      id: 'your-chat-id',
    });

  // Function to trigger document indexing
  const handleIndexDocuments = async () => {
    setIsIndexing(true);
    try {
      await fetch('/api/chat-rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Please index all documents in the knowledge base',
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Error indexing documents:', error);
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">EOS Chat AI with RAG</h1>

      {/* Admin controls */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">
          Knowledge Base Management
        </h2>
        <button
          type="button"
          onClick={handleIndexDocuments}
          disabled={isIndexing}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isIndexing ? 'Indexing Documents...' : 'Index All Documents'}
        </button>
        <p className="text-sm mt-2 text-gray-600">
          This will process and embed all text documents in the knowledge base.
        </p>
      </div>

      {/* Chat messages */}
      <div className="flex-1 space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
            } max-w-[80%] ${message.role === 'user' ? 'ml-auto' : 'mr-auto'}`}
          >
            <p className="font-semibold">
              {message.role === 'user' ? 'You' : 'EOS AI'}
            </p>
            <div className="whitespace-pre-wrap">
              {message.content || (
                <span className="italic text-gray-500">
                  {message.toolInvocations?.[0]?.toolName &&
                    `Using tool: ${message.toolInvocations[0].toolName}`}
                </span>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="bg-gray-100 p-4 rounded-lg max-w-[80%]">
            <p className="font-semibold">EOS AI</p>
            <p className="animate-pulse">Thinking...</p>
          </div>
        )}
      </div>

      {/* Chat input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question about EOS..."
          className="flex-1 p-2 border border-gray-300 rounded"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <div className="mt-4 text-sm text-gray-600">
        <p>Try asking about EOS concepts or adding knowledge to the system.</p>
        <p className="mt-1">
          Example: "Remember that the Core Values of EOS are simplicity,
          clarity, and being purpose-driven."
        </p>
      </div>
    </div>
  );
}
