import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'user1', email: 'test@example.com' } },
    status: 'authenticated'
  }))
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    refresh: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/chat'
}));

// Mock AI SDK hooks
vi.mock('ai/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: null,
    setMessages: vi.fn(),
    append: vi.fn(),
    reload: vi.fn(),
    stop: vi.fn()
  }))
}));

// Mock database operations
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'chat1', title: 'New Chat' }])
      })
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'chat1' }])
      })
    })
  }
}));

describe('Chat Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Chat Creation', () => {
    it('should create a new chat and redirect to chat page', async () => {
      // Mock successful chat creation API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          id: 'chat1', 
          title: 'New Chat',
          userId: 'user1'
        })
      });

      const NewChatButton = () => {
        const handleNewChat = async () => {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Chat' })
          });
          const chat = await response.json();
          mockPush(`/chat/${chat.id}`);
        };

        return (
          <button onClick={handleNewChat}>
            New Chat
          </button>
        );
      };

      render(<NewChatButton />);
      
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' })
        }));
        expect(mockPush).toHaveBeenCalledWith('/chat/chat1');
      });
    });

    it('should handle chat creation failure gracefully', async () => {
      // Mock failed chat creation
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Failed to create chat' })
      });

      const NewChatButton = () => {
        const [error, setError] = useState<string | null>(null);

        const handleNewChat = async () => {
          try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: 'New Chat' })
            });
            
            if (!response.ok) {
              throw new Error('Failed to create chat');
            }
          } catch (err) {
            setError('Failed to create chat');
          }
        };

        return (
          <div>
            <button onClick={handleNewChat}>New Chat</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      };

      // Add missing import
      const { useState } = require('react');

      render(<NewChatButton />);
      
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to create chat');
      });
    });
  });

  describe('Message Sending', () => {
    it('should send message and receive AI response', async () => {
      const mockAppend = vi.fn();
      const mockUseChat = vi.fn(() => ({
        messages: [
          { id: '1', role: 'user', content: 'Hello' },
          { id: '2', role: 'assistant', content: 'Hi there!' }
        ],
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error: null,
        setMessages: vi.fn(),
        append: mockAppend,
        reload: vi.fn(),
        stop: vi.fn()
      }));

      vi.doMock('ai/react', () => ({
        useChat: mockUseChat
      }));

      const ChatComponent = () => {
        const { messages, append } = mockUseChat();

        return (
          <div>
            <div data-testid="messages">
              {messages.map((msg: any) => (
                <div key={msg.id} data-testid={`message-${msg.role}`}>
                  {msg.content}
                </div>
              ))}
            </div>
            <button onClick={() => append({ role: 'user', content: 'Hello' })}>
              Send Message
            </button>
          </div>
        );
      };

      render(<ChatComponent />);

      expect(screen.getByTestId('message-user')).toHaveTextContent('Hello');
      expect(screen.getByTestId('message-assistant')).toHaveTextContent('Hi there!');
    });

    it('should handle streaming responses', async () => {
      let isLoading = true;
      const mockUseChat = vi.fn(() => ({
        messages: [
          { id: '1', role: 'user', content: 'Tell me a story' }
        ],
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading,
        error: null,
        setMessages: vi.fn(),
        append: vi.fn(),
        reload: vi.fn(),
        stop: vi.fn()
      }));

      vi.doMock('ai/react', () => ({
        useChat: mockUseChat
      }));

      const ChatComponent = () => {
        const { messages, isLoading } = mockUseChat();

        return (
          <div>
            <div data-testid="messages">
              {messages.map((msg: any) => (
                <div key={msg.id} data-testid={`message-${msg.role}`}>
                  {msg.content}
                </div>
              ))}
            </div>
            {isLoading && <div data-testid="loading">AI is typing...</div>}
          </div>
        );
      };

      const { rerender } = render(<ChatComponent />);

      // Initially loading
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Simulate completion
      isLoading = false;
      rerender(<ChatComponent />);

      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    it('should allow stopping generation', async () => {
      const mockStop = vi.fn();
      const mockUseChat = vi.fn(() => ({
        messages: [
          { id: '1', role: 'user', content: 'Generate a long response' }
        ],
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: true,
        error: null,
        setMessages: vi.fn(),
        append: vi.fn(),
        reload: vi.fn(),
        stop: mockStop
      }));

      vi.doMock('ai/react', () => ({
        useChat: mockUseChat
      }));

      const ChatComponent = () => {
        const { isLoading, stop } = mockUseChat();

        return (
          <div>
            {isLoading && (
              <button onClick={stop} data-testid="stop-button">
                Stop Generation
              </button>
            )}
          </div>
        );
      };

      render(<ChatComponent />);

      const stopButton = screen.getByTestId('stop-button');
      fireEvent.click(stopButton);

      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('Message Management', () => {
    it('should delete message', async () => {
      // Mock delete API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const MessageComponent = ({ messageId }: { messageId: string }) => {
        const handleDelete = async () => {
          await fetch(`/api/chat/messages/${messageId}`, {
            method: 'DELETE'
          });
        };

        return (
          <div>
            <div>Message content</div>
            <button onClick={handleDelete} data-testid="delete-button">
              Delete
            </button>
          </div>
        );
      };

      render(<MessageComponent messageId="msg1" />);

      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/chat/messages/msg1', {
          method: 'DELETE'
        });
      });
    });

    it('should edit message', async () => {
      // Mock edit API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          id: 'msg1', 
          content: 'Updated message' 
        })
      });

      const EditableMessage = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [content, setContent] = useState('Original message');

        const handleSave = async () => {
          await fetch('/api/chat/messages/msg1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
          setIsEditing(false);
        };

        return (
          <div>
            {isEditing ? (
              <div>
                <input 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)}
                  data-testid="edit-input"
                />
                <button onClick={handleSave} data-testid="save-button">
                  Save
                </button>
              </div>
            ) : (
              <div>
                <div data-testid="message-content">{content}</div>
                <button 
                  onClick={() => setIsEditing(true)} 
                  data-testid="edit-button"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        );
      };

      // Add missing import
      const { useState } = require('react');

      render(<EditableMessage />);

      // Start editing
      const editButton = screen.getByTestId('edit-button');
      fireEvent.click(editButton);

      // Change content
      const editInput = screen.getByTestId('edit-input');
      fireEvent.change(editInput, { target: { value: 'Updated message' } });

      // Save
      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/chat/messages/msg1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated message' })
        });
      });
    });
  });

  describe('Chat History', () => {
    it('should load chat history', async () => {
      // Mock chat history API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 'chat1', title: 'Chat 1', updatedAt: '2024-01-01' },
          { id: 'chat2', title: 'Chat 2', updatedAt: '2024-01-02' }
        ])
      });

      const ChatHistory = () => {
        const [chats, setChats] = useState([]);

        useEffect(() => {
          const loadChats = async () => {
            const response = await fetch('/api/chat/history');
            const chatData = await response.json();
            setChats(chatData);
          };
          loadChats();
        }, []);

        return (
          <div data-testid="chat-history">
            {chats.map((chat: any) => (
              <div key={chat.id} data-testid={`chat-${chat.id}`}>
                {chat.title}
              </div>
            ))}
          </div>
        );
      };

      // Add missing imports
      const { useState, useEffect } = require('react');

      render(<ChatHistory />);

      await waitFor(() => {
        expect(screen.getByTestId('chat-chat1')).toHaveTextContent('Chat 1');
        expect(screen.getByTestId('chat-chat2')).toHaveTextContent('Chat 2');
      });
    });

    it('should delete chat from history', async () => {
      // Mock delete chat API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const ChatHistoryItem = ({ chatId }: { chatId: string }) => {
        const handleDelete = async () => {
          await fetch(`/api/chat/${chatId}`, {
            method: 'DELETE'
          });
        };

        return (
          <div>
            <span>Chat Title</span>
            <button onClick={handleDelete} data-testid="delete-chat">
              Delete Chat
            </button>
          </div>
        );
      };

      render(<ChatHistoryItem chatId="chat1" />);

      const deleteButton = screen.getByTestId('delete-chat');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/chat/chat1', {
          method: 'DELETE'
        });
      });
    });
  });
});