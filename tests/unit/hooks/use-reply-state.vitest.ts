// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplyState } from '@/hooks/use-reply-state';

describe('useReplyState', () => {
  it('initializes with null reply state and not replying', () => {
    const { result } = renderHook(() => useReplyState());

    expect(result.current.replyState).toBeNull();
    expect(result.current.isReplying).toBe(false);
  });

  it('starts a reply with user message', () => {
    const { result } = renderHook(() => useReplyState());

    act(() => {
      result.current.startReply('msg-123', 'Hello world', 'user');
    });

    expect(result.current.isReplying).toBe(true);
    expect(result.current.replyState).toEqual({
      messageId: 'msg-123',
      content: 'Hello world',
      role: 'user',
      timestamp: expect.any(Date),
    });
  });

  it('starts a reply with assistant message', () => {
    const { result } = renderHook(() => useReplyState());

    act(() => {
      result.current.startReply('msg-456', 'AI response here', 'assistant');
    });

    expect(result.current.isReplying).toBe(true);
    expect(result.current.replyState).toEqual({
      messageId: 'msg-456',
      content: 'AI response here',
      role: 'assistant',
      timestamp: expect.any(Date),
    });
  });

  it('cancels a reply', () => {
    const { result } = renderHook(() => useReplyState());

    // Start a reply first
    act(() => {
      result.current.startReply('msg-123', 'Hello', 'user');
    });

    expect(result.current.isReplying).toBe(true);

    // Cancel it
    act(() => {
      result.current.cancelReply();
    });

    expect(result.current.replyState).toBeNull();
    expect(result.current.isReplying).toBe(false);
  });

  it('clears a reply', () => {
    const { result } = renderHook(() => useReplyState());

    // Start a reply first
    act(() => {
      result.current.startReply('msg-789', 'Test', 'assistant');
    });

    expect(result.current.isReplying).toBe(true);

    // Clear it
    act(() => {
      result.current.clearReply();
    });

    expect(result.current.replyState).toBeNull();
    expect(result.current.isReplying).toBe(false);
  });

  it('can replace an existing reply', () => {
    const { result } = renderHook(() => useReplyState());

    // Start first reply
    act(() => {
      result.current.startReply('msg-1', 'First message', 'user');
    });

    expect(result.current.replyState?.messageId).toBe('msg-1');

    // Replace with new reply
    act(() => {
      result.current.startReply('msg-2', 'Second message', 'assistant');
    });

    expect(result.current.replyState?.messageId).toBe('msg-2');
    expect(result.current.replyState?.content).toBe('Second message');
    expect(result.current.replyState?.role).toBe('assistant');
    expect(result.current.isReplying).toBe(true);
  });

  it('handles empty content', () => {
    const { result } = renderHook(() => useReplyState());

    act(() => {
      result.current.startReply('msg-empty', '', 'user');
    });

    expect(result.current.replyState?.content).toBe('');
    expect(result.current.isReplying).toBe(true);
  });

  it('handles long content', () => {
    const { result } = renderHook(() => useReplyState());
    const longContent = 'A'.repeat(10000);

    act(() => {
      result.current.startReply('msg-long', longContent, 'user');
    });

    expect(result.current.replyState?.content).toBe(longContent);
    expect(result.current.replyState?.content.length).toBe(10000);
  });

  it('timestamps are unique per reply', async () => {
    const { result } = renderHook(() => useReplyState());

    act(() => {
      result.current.startReply('msg-1', 'First', 'user');
    });

    const firstTimestamp = result.current.replyState?.timestamp;

    // Small delay to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    act(() => {
      result.current.startReply('msg-2', 'Second', 'user');
    });

    const secondTimestamp = result.current.replyState?.timestamp;

    expect(firstTimestamp).not.toEqual(secondTimestamp);
  });

  it('cancel and clear have the same effect', () => {
    const { result } = renderHook(() => useReplyState());

    // Test cancel
    act(() => {
      result.current.startReply('msg-1', 'Test', 'user');
    });
    act(() => {
      result.current.cancelReply();
    });

    const stateAfterCancel = {
      replyState: result.current.replyState,
      isReplying: result.current.isReplying,
    };

    // Test clear
    act(() => {
      result.current.startReply('msg-2', 'Test', 'user');
    });
    act(() => {
      result.current.clearReply();
    });

    const stateAfterClear = {
      replyState: result.current.replyState,
      isReplying: result.current.isReplying,
    };

    expect(stateAfterCancel).toEqual(stateAfterClear);
  });

  it('calling cancel when not replying is safe', () => {
    const { result } = renderHook(() => useReplyState());

    // Should not throw
    act(() => {
      result.current.cancelReply();
    });

    expect(result.current.replyState).toBeNull();
    expect(result.current.isReplying).toBe(false);
  });

  it('calling clear when not replying is safe', () => {
    const { result } = renderHook(() => useReplyState());

    // Should not throw
    act(() => {
      result.current.clearReply();
    });

    expect(result.current.replyState).toBeNull();
    expect(result.current.isReplying).toBe(false);
  });
});
