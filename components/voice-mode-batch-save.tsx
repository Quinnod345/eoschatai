'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { toast as customToast } from '@/lib/toast-system';
import { cn } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { VOICE_CONFIG, VOICE_EVENTS, VOICE_STATES } from '@/lib/voice/config';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { useSWRConfig } from 'swr';

interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId?: string;
  selectedProviderId?: string;
  selectedPersonaId?: string;
  selectedProfileId?: string;
  chatId?: string;
  onMessagesUpdate?: (messages: any[]) => void;
  onChatCreated?: (chatId: string) => void;
}

type ConnectionStatus =
  (typeof VOICE_STATES.CONNECTION)[keyof typeof VOICE_STATES.CONNECTION];
type VoiceSessionState =
  (typeof VOICE_STATES.SESSION)[keyof typeof VOICE_STATES.SESSION];

interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isComplete: boolean;
  hasContent?: boolean;
}

export default function VoiceModeBatchSave({
  isOpen,
  onClose,
  selectedModelId,
  selectedProviderId,
  selectedPersonaId,
  selectedProfileId,
  chatId: existingChatId,
  onMessagesUpdate,
  onChatCreated,
}: VoiceModeProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  // Core state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    VOICE_STATES.CONNECTION.DISCONNECTED,
  );
  const [sessionState, setSessionState] = useState<VoiceSessionState>(
    VOICE_STATES.SESSION.IDLE,
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Session management
  const [sessionChatId, setSessionChatId] = useState<string | null>(null);

  // Message tracking - all in memory until save
  const messagesRef = useRef<VoiceMessage[]>([]);
  const pendingAssistantMessageRef = useRef<VoiceMessage | null>(null);
  const lastUserSpeechTimeRef = useRef<number>(0);

  // Track if we have messages to save
  const hasMessagesRef = useRef(false);

  // Track if cleanup is in progress to prevent multiple calls
  const cleanupInProgressRef = useRef(false);

  // Session info
  const [sessionInfo, setSessionInfo] = useState<{
    personaName?: string;
    profileName?: string;
    instructions?: string;
  } | null>(null);

  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Get or create chat ID for this session
  const getSessionChatId = useCallback(() => {
    // Always use the provided chatId if available
    if (existingChatId) {
      return existingChatId;
    }
    // For new chats, ensure we have a consistent session ID
    if (!sessionChatId) {
      const newId = generateUUID();
      setSessionChatId(newId);
      return newId;
    }
    return sessionChatId;
  }, [existingChatId, sessionChatId]);

  // Save all messages at once when closing
  const saveAllMessages = useCallback(async () => {
    // Include any pending assistant message
    const allMessages = [...messagesRef.current];

    // If there's a pending assistant message, add it to the save queue
    if (
      pendingAssistantMessageRef.current &&
      pendingAssistantMessageRef.current.content.trim()
    ) {
      console.log('[Voice Mode] Including pending assistant message in save');
      const pendingMessage = {
        ...pendingAssistantMessageRef.current,
        content: pendingAssistantMessageRef.current.content + ' [interrupted]',
        isComplete: true,
        // Ensure timestamp is after any existing messages
        timestamp:
          Math.max(
            pendingAssistantMessageRef.current.timestamp,
            ...allMessages.map((m) => m.timestamp),
            Date.now(),
          ) + 1,
      };
      allMessages.push(pendingMessage);
    }

    // Sort messages by timestamp to ensure proper order
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Final check: ensure no assistant message has a timestamp before its corresponding user message
    for (let i = 0; i < allMessages.length; i++) {
      if (allMessages[i].role === 'assistant' && i > 0) {
        // Find the most recent user message before this assistant message
        let lastUserIndex = -1;
        for (let j = i - 1; j >= 0; j--) {
          if (allMessages[j].role === 'user') {
            lastUserIndex = j;
            break;
          }
        }

        // If assistant timestamp is before or equal to user timestamp, fix it
        if (
          lastUserIndex >= 0 &&
          allMessages[i].timestamp <= allMessages[lastUserIndex].timestamp
        ) {
          console.log(
            '[Voice Mode] Fixing out-of-order assistant message timestamp',
          );
          allMessages[i].timestamp = allMessages[lastUserIndex].timestamp + 10;
        }
      }
    }

    // Re-sort after potential timestamp fixes
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    console.log(
      '[Voice Mode] saveAllMessages called, total messages (sorted and fixed):',
      allMessages.length,
      allMessages.map((m) => ({
        role: m.role,
        time: new Date(m.timestamp).toISOString(),
      })),
    );

    if (allMessages.length === 0) {
      console.log('[Voice Mode] No messages to save');
      return null;
    }

    setIsSaving(true);
    const chatId = getSessionChatId();

    console.log('[Voice Mode] Saving all messages:', {
      chatId,
      messageCount: messagesRef.current.length,
      isNewChat: !existingChatId,
    });

    try {
      // Always save messages - for new chats, create the chat too
      if (!existingChatId) {
        console.log('[Voice Mode] Creating new chat and saving messages');
        const response = await fetch('/api/voice/batch-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            messages: allMessages,
            selectedPersonaId,
            selectedProfileId,
            provider: selectedProviderId || 'openai',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[Voice Mode] Batch save failed:', errorData);
          throw new Error(
            errorData.error || 'Failed to save voice conversation',
          );
        }

        const data = await response.json();
        console.log('[Voice Mode] Batch save successful:', data);

        // Ensure we have the chat ID
        const savedChatId = data.chatId || chatId;

        // Update sidebar immediately
        try {
          await mutate(unstable_serialize(getChatHistoryPaginationKey));

          // Dispatch custom event for sidebar to listen to
          window.dispatchEvent(
            new CustomEvent('voiceChatCreated', {
              detail: { chatId: savedChatId },
            }),
          );
        } catch (e) {
          console.error('[Voice Mode] Error updating sidebar:', e);
        }

        // Notify parent
        if (onChatCreated) {
          onChatCreated(savedChatId);
        }

        return savedChatId;
      } else {
        // For existing chat, save messages individually
        console.log(
          '[Voice Mode] Saving messages to existing chat:',
          existingChatId,
        );
        for (const message of allMessages) {
          await fetch('/api/voice/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              [message.role === 'user' ? 'userMessage' : 'assistantMessage']: {
                id: message.id,
                content: message.content,
                timestamp: message.timestamp,
              },
              selectedPersonaId,
              selectedProfileId,
              provider: selectedProviderId || 'openai',
            }),
          });
        }
        return existingChatId; // Return the existing chat ID so we can navigate to it
      }
    } catch (error) {
      console.error('[Voice Mode] Error saving messages:', error);
      customToast.error('Failed to save voice conversation');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [
    getSessionChatId,
    existingChatId,
    selectedPersonaId,
    selectedProfileId,
    selectedProviderId,
    mutate,
    onChatCreated,
  ]);

  // Add message to memory
  const addMessage = useCallback(
    (message: VoiceMessage) => {
      // Only add messages with actual content
      if (!message.content || message.content.trim().length === 0) {
        console.log('[Voice Mode] Skipping empty message');
        return;
      }

      console.log('[Voice Mode] Adding message to memory:', {
        id: message.id,
        role: message.role,
        contentLength: message.content.length,
        content: message.content.substring(0, 50) + '...',
        timestamp: new Date(message.timestamp).toISOString(),
      });

      messagesRef.current.push(message);
      hasMessagesRef.current = true;

      // Sort messages by timestamp after adding
      messagesRef.current.sort((a, b) => a.timestamp - b.timestamp);

      // Update UI if callback provided
      if (onMessagesUpdate) {
        // Ensure messages are sorted before updating UI
        const sortedMessages = [...messagesRef.current].sort(
          (a, b) => a.timestamp - b.timestamp,
        );

        // Filter out system messages and only include user/assistant messages
        const uiMessages = sortedMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: new Date(m.timestamp),
            parts: [{ type: 'text', text: m.content }],
          }));

        onMessagesUpdate(uiMessages);
      }
    },
    [onMessagesUpdate],
  );

  // Initialize WebRTC connection
  const initializeConnection = useCallback(async () => {
    // Double-check modal is open
    if (!isOpen) {
      console.log('[Voice Mode] Attempted to initialize but modal is closed');
      return;
    }

    if (
      connectionStatus !== VOICE_STATES.CONNECTION.DISCONNECTED ||
      sessionState !== VOICE_STATES.SESSION.IDLE
    ) {
      return;
    }

    // Prevent initialization if cleanup is in progress
    if (cleanupInProgressRef.current) {
      console.log('[Voice Mode] Cleanup in progress, skipping initialization');
      return;
    }

    // Clean up any existing connection before creating new one
    if (peerConnectionRef.current) {
      console.log(
        '[Voice Mode] Cleaning up existing connection before new initialization',
      );
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.error('[Voice Mode] Error closing existing connection:', e);
      }
      peerConnectionRef.current = null;
    }

    setSessionState(VOICE_STATES.SESSION.INITIALIZING);
    setConnectionStatus(VOICE_STATES.CONNECTION.CONNECTING);

    const chatId = getSessionChatId();
    console.log('[Voice Mode] Initializing with chat ID:', chatId);

    try {
      // Get ephemeral token
      const tokenResponse = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedPersonaId,
          selectedProfileId,
          chatId,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get session token');
      }

      const tokenData = await tokenResponse.json();
      const ephemeralKey = tokenData.client_secret;

      setSessionInfo({
        personaName: tokenData.personaName,
        profileName: tokenData.profileName,
        instructions: tokenData.instructions,
      });

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: VOICE_CONFIG.webrtc.iceServers,
      });
      peerConnectionRef.current = pc;

      // Set up audio element
      audioElementRef.current = document.createElement('audio');
      audioElementRef.current.autoplay = true;

      pc.ontrack = (event) => {
        console.log('[Voice Mode] Received remote audio track');
        // @ts-ignore - connectionState types are incomplete
        if (
          audioElementRef.current &&
          isOpen &&
          peerConnectionRef.current &&
          peerConnectionRef.current.connectionState !== 'disconnected' &&
          peerConnectionRef.current.connectionState !== 'failed'
        ) {
          audioElementRef.current.srcObject = event.streams[0];
        }
      };

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: VOICE_CONFIG.audio.input,
      });
      mediaStreamRef.current = stream;

      // Check if connection is still valid before adding tracks
      // @ts-ignore - connectionState types are incomplete
      if (
        !peerConnectionRef.current ||
        peerConnectionRef.current.connectionState === 'disconnected' ||
        peerConnectionRef.current.connectionState === 'failed'
      ) {
        console.log('[Voice Mode] Peer connection closed before adding tracks');
        // Clean up the stream we just created
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        throw new Error('Connection closed during initialization');
      }

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Set up audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = VOICE_CONFIG.audio.analyser.fftSize;
      source.connect(analyser);
      analyserRef.current = analyser;
      monitorAudioLevel();

      // Create data channel
      const dataChannel = pc.createDataChannel('oai-events', { ordered: true });
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        // Check if modal is still open before proceeding
        if (!isOpen) {
          console.log(
            '[Voice Mode] Data channel opened but modal is closed, cleaning up',
          );
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
          return;
        }

        console.log('[Voice Mode] Data channel opened');
        setConnectionStatus(VOICE_STATES.CONNECTION.CONNECTED);
        setSessionState(VOICE_STATES.SESSION.READY);
        customToast.success('Voice mode ready');

        // Clear the greeting by adding a system message when voice mode starts
        if (onMessagesUpdate && messagesRef.current.length === 0) {
          // Add a temporary system message to hide the greeting
          const systemMessage = {
            id: 'voice-mode-active',
            role: 'system' as const,
            content: '',
            createdAt: new Date(),
            parts: [{ type: 'text' as const, text: '' }],
          };
          onMessagesUpdate([systemMessage]);
        }

        // Send session configuration
        sendEvent({
          type: 'session.update',
          session: {
            instructions:
              tokenData.instructions || 'You are a helpful AI assistant.',
            voice: VOICE_CONFIG.voice.default,
            input_audio_format: VOICE_CONFIG.audio.format.input,
            output_audio_format: VOICE_CONFIG.audio.format.output,
            input_audio_transcription: {
              model: VOICE_CONFIG.session.transcriptionModel,
            },
            turn_detection: VOICE_CONFIG.turnDetection,
            tools: [],
            temperature: VOICE_CONFIG.session.temperature,
            max_response_output_tokens:
              VOICE_CONFIG.session.maxResponseOutputTokens,
          },
        });
      };

      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeEvent(message);
        } catch (error) {
          console.error('[Voice Mode] Error parsing message:', error);
        }
      };

      dataChannel.onerror = (error) => {
        console.error('[Voice Mode] Data channel error:', error);
      };

      dataChannel.onclose = () => {
        console.log('[Voice Mode] Data channel closed');
        handleDisconnection();
      };

      // Create offer and connect
      // Check if connection is still valid before creating offer
      if (
        !peerConnectionRef.current ||
        (peerConnectionRef.current.connectionState as any) === 'disconnected' ||
        (peerConnectionRef.current.connectionState as any) === 'failed'
      ) {
        console.log(
          '[Voice Mode] Peer connection closed before creating offer',
        );
        throw new Error('Connection closed before initialization');
      }

      const offer = await pc.createOffer();

      // Check again before setting local description
      if (
        !peerConnectionRef.current ||
        (peerConnectionRef.current.connectionState as any) === 'disconnected' ||
        (peerConnectionRef.current.connectionState as any) === 'failed'
      ) {
        console.log(
          '[Voice Mode] Peer connection closed before setting local description',
        );
        throw new Error('Connection closed during initialization');
      }

      await pc.setLocalDescription(offer);

      const baseUrl = VOICE_CONFIG.webrtc.baseUrl;
      const model = VOICE_CONFIG.webrtc.model;

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();

      // Check if connection is still valid before setting remote description
      if (
        !peerConnectionRef.current ||
        (peerConnectionRef.current.connectionState as any) === 'disconnected' ||
        (peerConnectionRef.current.connectionState as any) === 'failed'
      ) {
        console.log(
          '[Voice Mode] Peer connection closed before setting remote description',
        );
        throw new Error('Connection closed during initialization');
      }

      // Double-check modal is still open
      if (!isOpen) {
        console.log('[Voice Mode] Modal closed during initialization');
        pc.close();
        throw new Error('Modal closed during initialization');
      }

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      console.log('[Voice Mode] WebRTC connection established');
    } catch (error: any) {
      console.error('[Voice Mode] Connection error:', error);

      // Clean up any partially created resources
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        mediaStreamRef.current = null;
      }

      if (
        peerConnectionRef.current &&
        (peerConnectionRef.current.connectionState as any) !== 'disconnected' &&
        (peerConnectionRef.current.connectionState as any) !== 'failed'
      ) {
        try {
          peerConnectionRef.current.close();
        } catch (e) {
          console.error(
            '[Voice Mode] Error closing peer connection in error handler:',
            e,
          );
        }
        peerConnectionRef.current = null;
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.error(
            '[Voice Mode] Error closing audio context in error handler:',
            e,
          );
        }
        audioContextRef.current = null;
      }

      setConnectionStatus(VOICE_STATES.CONNECTION.ERROR);
      setSessionState(VOICE_STATES.SESSION.IDLE);

      // Only show error toast if modal is still open
      if (isOpen && error.message !== 'Modal closed during initialization') {
        toast.error(error.message || 'Failed to connect to voice service');
      }
    }
  }, [
    connectionStatus,
    sessionState,
    getSessionChatId,
    selectedPersonaId,
    selectedProfileId,
    isOpen,
  ]);

  // Send event through data channel
  const sendEvent = useCallback((event: any) => {
    if (dataChannelRef.current?.readyState === 'open') {
      event.event_id = event.event_id || crypto.randomUUID();
      dataChannelRef.current.send(JSON.stringify(event));
    }
  }, []);

  // Handle incoming realtime events
  const handleRealtimeEvent = useCallback(
    (event: any) => {
      switch (event.type) {
        case VOICE_EVENTS.SESSION_CREATED:
        case VOICE_EVENTS.SESSION_UPDATE:
          console.log('[Voice Mode] Session event:', event.type);
          setSessionState(VOICE_STATES.SESSION.ACTIVE);
          break;

        case VOICE_EVENTS.SPEECH_STARTED:
          setIsListening(true);
          // Track when user started speaking for proper timestamp ordering
          lastUserSpeechTimeRef.current = Date.now();
          console.log(
            '[Voice Mode] User started speaking at:',
            lastUserSpeechTimeRef.current,
          );

          // Handle interruption - save any partial response
          if (
            pendingAssistantMessageRef.current &&
            !pendingAssistantMessageRef.current.isComplete &&
            pendingAssistantMessageRef.current.content.trim()
          ) {
            console.log(
              '[Voice Mode] User interrupted assistant, saving partial response',
            );
            const interrupted = {
              ...pendingAssistantMessageRef.current,
              content:
                pendingAssistantMessageRef.current.content + ' [interrupted]',
              isComplete: true,
              // Ensure interrupted message timestamp is before the new user speech
              timestamp: Math.min(
                pendingAssistantMessageRef.current.timestamp,
                lastUserSpeechTimeRef.current - 10,
              ),
            };
            addMessage(interrupted);
            pendingAssistantMessageRef.current = null;
            // Cancel the response
            sendEvent({ type: 'response.cancel' });
          }
          break;

        case VOICE_EVENTS.SPEECH_STOPPED:
          setIsListening(false);
          break;

        case VOICE_EVENTS.USER_TRANSCRIPTION_COMPLETED:
          if (event?.transcript && event?.item_id) {
            // Use the speech start time if available, otherwise use current time
            const timestamp = lastUserSpeechTimeRef.current || Date.now();

            const userMessage: VoiceMessage = {
              id: generateUUID(),
              role: 'user',
              content: event.transcript,
              timestamp: timestamp,
              isComplete: true,
            };

            console.log(
              '[Voice Mode] Adding user message with timestamp:',
              timestamp,
            );
            addMessage(userMessage);

            // Update last user speech time
            lastUserSpeechTimeRef.current = timestamp;

            // If there's a pending assistant message that was created before this user message,
            // update its timestamp to be after the user message
            if (
              pendingAssistantMessageRef.current &&
              pendingAssistantMessageRef.current.timestamp <= timestamp
            ) {
              console.log(
                '[Voice Mode] Updating assistant timestamp to be after user message',
              );
              pendingAssistantMessageRef.current.timestamp = timestamp + 10; // 10ms after user message
            }
          }
          break;

        case VOICE_EVENTS.RESPONSE_CREATED:
          console.log('[Voice Mode] Response created');
          // Use the last user speech time or find the last user message
          const lastUserMessage = messagesRef.current
            .filter((m) => m.role === 'user')
            .sort((a, b) => b.timestamp - a.timestamp)[0];

          // Use the most recent timestamp between last user speech and last user message
          const referenceTime = Math.max(
            lastUserSpeechTimeRef.current || 0,
            lastUserMessage?.timestamp || 0,
            Date.now() - 1000, // Fallback to 1 second ago if no user interaction yet
          );

          const assistantTimestamp = referenceTime + 10; // Always 10ms after the reference time

          const newAssistant: VoiceMessage = {
            id: generateUUID(),
            role: 'assistant',
            content: '',
            timestamp: assistantTimestamp,
            isComplete: false,
          };
          pendingAssistantMessageRef.current = newAssistant;
          console.log(
            '[Voice Mode] Assistant message created with timestamp:',
            assistantTimestamp,
            'after reference time:',
            referenceTime,
          );
          break;

        case VOICE_EVENTS.RESPONSE_TRANSCRIPT_DELTA:
          if (event?.delta && pendingAssistantMessageRef.current) {
            pendingAssistantMessageRef.current.content += event.delta;
            // Mark that we have received content
            pendingAssistantMessageRef.current.hasContent = true;

            // Double-check timestamp ordering - assistant should always be after last user message
            const lastUserMsg = messagesRef.current
              .filter((m) => m.role === 'user')
              .sort((a, b) => b.timestamp - a.timestamp)[0];

            if (
              lastUserMsg &&
              pendingAssistantMessageRef.current.timestamp <=
                lastUserMsg.timestamp
            ) {
              console.log(
                '[Voice Mode] Fixing assistant timestamp in transcript delta',
              );
              pendingAssistantMessageRef.current.timestamp =
                lastUserMsg.timestamp + 10;
            }

            // Update UI in real-time
            if (onMessagesUpdate) {
              const allMessages = [
                ...messagesRef.current,
                pendingAssistantMessageRef.current,
              ].sort((a, b) => a.timestamp - b.timestamp);

              // Filter out system messages and only include user/assistant messages
              const uiMessages = allMessages
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  createdAt: new Date(m.timestamp),
                  parts: [{ type: 'text', text: m.content }],
                }));

              onMessagesUpdate(uiMessages);
            }
          }
          break;

        case VOICE_EVENTS.RESPONSE_AUDIO_STARTED:
          setIsPlaying(true);
          break;

        case VOICE_EVENTS.RESPONSE_AUDIO_DONE:
          setIsPlaying(false);
          break;

        case VOICE_EVENTS.RESPONSE_DONE:
          console.log('[Voice Mode] Response done');
          if (
            pendingAssistantMessageRef.current &&
            pendingAssistantMessageRef.current.content.trim()
          ) {
            const completed = {
              ...pendingAssistantMessageRef.current,
              isComplete: true,
            };
            addMessage(completed);
            pendingAssistantMessageRef.current = null;
          } else if (pendingAssistantMessageRef.current) {
            console.log(
              '[Voice Mode] Response done but no content, clearing pending',
            );
            pendingAssistantMessageRef.current = null;
          }
          break;

        case VOICE_EVENTS.ERROR:
          console.error('[Voice Mode] Realtime API error:', event.error);
          toast.error(
            `Voice error: ${event.error?.message || 'Unknown error'}`,
          );
          break;
      }
    },
    [addMessage, sendEvent, onMessagesUpdate],
  );

  // Monitor audio level
  const monitorAudioLevel = () => {
    if (!analyserRef.current || !isOpen) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    let animationId: number;

    const updateLevel = () => {
      if (!analyserRef.current || !isOpen) {
        if (animationId) cancelAnimationFrame(animationId);
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);
      const average =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(average / 255);

      animationId = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  // Handle disconnection
  const handleDisconnection = () => {
    setConnectionStatus(VOICE_STATES.CONNECTION.DISCONNECTED);
    setSessionState(VOICE_STATES.SESSION.IDLE);
    setIsListening(false);
    setIsPlaying(false);
  };

  // Verify chat exists before navigating
  const verifyAndNavigate = useCallback(
    async (chatId: string, retries = 5) => {
      console.log(
        `[Voice Mode] Verifying chat exists: ${chatId}, retries left: ${retries}`,
      );
      setIsNavigating(true);

      try {
        const response = await fetch(`/api/chat/${chatId}/verify`);
        const data = await response.json();

        if (data.exists) {
          console.log('[Voice Mode] Chat verified, navigating now');

          // Dispatch event for sidebar to listen to
          window.dispatchEvent(
            new CustomEvent('voiceChatCreated', {
              detail: { chatId },
            }),
          );

          // Check if we're already on this chat page
          const currentPath = window.location.pathname;
          if (currentPath === `/chat/${chatId}`) {
            // We're already on this chat, reload to show new messages
            console.log('[Voice Mode] Already on chat page, reloading...');
            window.location.reload();
          } else {
            // Navigate to the chat
            console.log('[Voice Mode] Navigating to:', `/chat/${chatId}`);
            router.push(`/chat/${chatId}`);
          }
        } else if (retries > 0) {
          // Retry after a delay
          console.log('[Voice Mode] Chat not found yet, retrying...');
          setTimeout(() => {
            verifyAndNavigate(chatId, retries - 1);
          }, 500);
        } else {
          console.error('[Voice Mode] Chat not found after all retries');
          customToast.error(
            'Failed to navigate to chat. Please check your chat history.',
          );
          setIsNavigating(false);
        }
      } catch (error) {
        console.error('[Voice Mode] Error verifying chat:', error);
        if (retries > 0) {
          setTimeout(() => {
            verifyAndNavigate(chatId, retries - 1);
          }, 500);
        } else {
          setIsNavigating(false);
        }
      }
    },
    [router, mutate],
  );

  // Stop voice session
  const stopVoiceSession = useCallback(async () => {
    // Prevent multiple cleanup calls
    if (cleanupInProgressRef.current) {
      console.log('[Voice Mode] Cleanup already in progress, skipping');
      return;
    }

    cleanupInProgressRef.current = true;

    console.log(
      '[Voice Mode] Stopping session, messages:',
      messagesRef.current.length,
    );
    setSessionState(VOICE_STATES.SESSION.ENDING);

    // Before closing connections, check if we have a pending assistant message
    if (
      pendingAssistantMessageRef.current &&
      pendingAssistantMessageRef.current.content.trim()
    ) {
      console.log(
        '[Voice Mode] Saving pending assistant message before cleanup',
      );
      const partialMessage = {
        ...pendingAssistantMessageRef.current,
        content:
          pendingAssistantMessageRef.current.content + ' [session ended]',
        isComplete: true,
        // Keep original timestamp to maintain order
        timestamp: pendingAssistantMessageRef.current.timestamp,
      };
      addMessage(partialMessage);
      pendingAssistantMessageRef.current = null;
    }

    // First, close the data channel to stop all communication
    if (dataChannelRef.current) {
      console.log('[Voice Mode] Closing data channel');
      try {
        dataChannelRef.current.close();
      } catch (e) {
        console.error('[Voice Mode] Error closing data channel:', e);
      }
      dataChannelRef.current = null;
    }

    // Stop all audio tracks
    if (mediaStreamRef.current) {
      console.log('[Voice Mode] Stopping media stream tracks');
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      mediaStreamRef.current = null;
    }

    // Clean up audio element
    if (audioElementRef.current) {
      console.log('[Voice Mode] Cleaning up audio element');
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      console.log('[Voice Mode] Closing peer connection');
      peerConnectionRef.current.getTransceivers().forEach((transceiver) => {
        if (transceiver.stop) transceiver.stop();
      });
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      console.log('[Voice Mode] Closing audio context');
      try {
        await audioContextRef.current.close();
      } catch (e) {
        console.error('[Voice Mode] Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }

    // Reset all refs
    analyserRef.current = null;

    // Reset state
    handleDisconnection();

    // Determine chat ID to navigate to
    let chatIdToNavigate = existingChatId;
    let shouldNavigate = false;

    // Check if we have any messages to save (including pending assistant message)
    const hasMessages =
      messagesRef.current.length > 0 ||
      (pendingAssistantMessageRef.current &&
        pendingAssistantMessageRef.current.content.trim());

    // Save messages if we have any
    if (hasMessages) {
      console.log('[Voice Mode] Saving messages before navigation');
      const savedChatId = await saveAllMessages();
      if (savedChatId) {
        chatIdToNavigate = savedChatId;
        shouldNavigate = true;
      }
    } else {
      console.log('[Voice Mode] No messages to save');
    }

    // Clear messages after save
    messagesRef.current = [];
    pendingAssistantMessageRef.current = null;
    hasMessagesRef.current = false;

    // Navigate to the chat after verifying it exists
    if (shouldNavigate && chatIdToNavigate) {
      console.log(
        '[Voice Mode] Will verify and navigate to chat:',
        chatIdToNavigate,
      );

      // Start navigation process immediately
      verifyAndNavigate(chatIdToNavigate);
    } else {
      console.log('[Voice Mode] No navigation needed, closing modal');
      // If no messages were recorded or we're in an existing chat, just close
      onClose();
    }

    // Reset cleanup flag
    cleanupInProgressRef.current = false;
  }, [saveAllMessages, verifyAndNavigate, existingChatId, onClose, addMessage]);

  // Removed - sidebar refresh is handled by the chat page itself

  // Toggle mute
  const toggleMute = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);

      if (!isMuted) {
        sendEvent({ type: VOICE_EVENTS.AUDIO_BUFFER_CLEAR });
      }
    }
  };

  // Handle modal lifecycle
  useEffect(() => {
    if (isOpen && connectionStatus === VOICE_STATES.CONNECTION.DISCONNECTED) {
      console.log('[Voice Mode] Opening modal');
      // Reset state
      messagesRef.current = [];
      pendingAssistantMessageRef.current = null;
      hasMessagesRef.current = false;
      lastUserSpeechTimeRef.current = 0;
      setSessionChatId(null);
      cleanupInProgressRef.current = false;

      const timer = setTimeout(() => {
        // Double-check modal is still open before initializing
        if (isOpen) {
          initializeConnection();
        }
      }, 200); // Slightly longer delay to ensure modal is fully rendered
      return () => clearTimeout(timer);
    }
  }, [isOpen, connectionStatus, initializeConnection]);

  // Handle close
  const handleClose = async () => {
    console.log('[Voice Mode] handleClose called');
    if (
      connectionStatus !== VOICE_STATES.CONNECTION.DISCONNECTED &&
      !cleanupInProgressRef.current
    ) {
      // Wait for the stop session to complete before closing modal
      await stopVoiceSession();
      // Don't close immediately - let stopVoiceSession handle it
      // This ensures any pending messages are saved
    } else {
      onClose();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupInProgressRef.current) return;

      console.log('[Voice Mode] Component unmounting, cleaning up...');
      // Force cleanup regardless of connection status
      if (
        peerConnectionRef.current ||
        dataChannelRef.current ||
        mediaStreamRef.current
      ) {
        cleanupInProgressRef.current = true;

        // Clean up without navigation logic
        if (dataChannelRef.current) {
          try {
            dataChannelRef.current.close();
          } catch (e) {}
          dataChannelRef.current = null;
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
          mediaStreamRef.current = null;
        }

        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current.srcObject = null;
          audioElementRef.current.remove();
          audioElementRef.current = null;
        }

        if (peerConnectionRef.current) {
          peerConnectionRef.current.getTransceivers().forEach((transceiver) => {
            if (transceiver.stop) transceiver.stop();
          });
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }

        if (
          audioContextRef.current &&
          audioContextRef.current.state !== 'closed'
        ) {
          try {
            audioContextRef.current.close();
          } catch (e) {}
          audioContextRef.current = null;
        }

        analyserRef.current = null;
      }
    };
  }, []);

  // Ensure we don't render anything if modal is closed
  if (!isOpen) {
    return null;
  }

  // Get display transcript
  const displayTranscript = messagesRef.current
    .slice(-VOICE_CONFIG.ui.maxTranscriptMessages)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          // Only close if clicking directly on the backdrop and not saving/navigating
          if (e.target === e.currentTarget && !isSaving && !isNavigating) {
            handleClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md relative z-10"
        >
          <Card className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Voice Mode</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={
                      connectionStatus === VOICE_STATES.CONNECTION.CONNECTED
                        ? 'default'
                        : 'secondary'
                    }
                    className={cn(
                      connectionStatus === VOICE_STATES.CONNECTION.CONNECTED &&
                        'bg-green-500 hover:bg-green-600',
                      connectionStatus === VOICE_STATES.CONNECTION.CONNECTING &&
                        'bg-yellow-500 hover:bg-yellow-600',
                      connectionStatus === VOICE_STATES.CONNECTION.ERROR &&
                        'bg-red-500 hover:bg-red-600',
                    )}
                  >
                    {connectionStatus === VOICE_STATES.CONNECTION.CONNECTED &&
                      'Connected'}
                    {connectionStatus === VOICE_STATES.CONNECTION.CONNECTING &&
                      'Connecting...'}
                    {connectionStatus ===
                      VOICE_STATES.CONNECTION.DISCONNECTED && 'Disconnected'}
                    {connectionStatus === VOICE_STATES.CONNECTION.ERROR &&
                      'Error'}
                  </Badge>
                  {sessionInfo?.personaName && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {sessionInfo.personaName}
                        {sessionInfo.profileName &&
                          ` - ${sessionInfo.profileName}`}
                      </span>
                    </>
                  )}
                  {(existingChatId || sessionChatId) && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-green-600 font-medium">
                        {existingChatId ? 'In chat' : 'New conversation'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                disabled={isSaving || isNavigating}
              >
                {isSaving || isNavigating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneOff className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Audio Visualizer */}
            <div className="flex items-center justify-center py-8">
              <motion.div
                className="relative"
                animate={{
                  scale: 1 + audioLevel * 0.3,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <div
                  className={cn(
                    'w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-300',
                    isListening
                      ? 'bg-green-500 shadow-lg shadow-green-500/50'
                      : isPlaying
                        ? 'bg-blue-500 shadow-lg shadow-blue-500/50'
                        : 'bg-eos-orange shadow-lg shadow-eos-orange/50',
                  )}
                >
                  {sessionState === VOICE_STATES.SESSION.INITIALIZING ? (
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  ) : isMuted ? (
                    <MicOff className="h-8 w-8 text-white" />
                  ) : (
                    <Mic className="h-8 w-8 text-white" />
                  )}
                </div>

                {/* Audio level rings */}
                {audioLevel > VOICE_CONFIG.ui.audioLevelThreshold &&
                  sessionState === VOICE_STATES.SESSION.ACTIVE && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-white/30"
                        animate={{
                          scale: 1 + audioLevel * 0.5,
                          opacity: 0.7 - audioLevel * 0.3,
                        }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-white/20"
                        animate={{
                          scale: 1 + audioLevel * 0.8,
                          opacity: 0.5 - audioLevel * 0.2,
                        }}
                      />
                    </>
                  )}
              </motion.div>
            </div>

            {/* Status */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {sessionState === VOICE_STATES.SESSION.INITIALIZING &&
                  'Initializing voice session...'}
                {sessionState === VOICE_STATES.SESSION.READY &&
                  'Voice mode ready'}
                {sessionState === VOICE_STATES.SESSION.ACTIVE &&
                  (isListening ? (
                    <span className="text-green-600 font-medium">
                      Listening...
                    </span>
                  ) : isPlaying ? (
                    <span className="text-blue-600 font-medium">
                      AI is speaking...
                    </span>
                  ) : (
                    "Speak naturally, I'm here to help!"
                  ))}
                {sessionState === VOICE_STATES.SESSION.ENDING &&
                  (isSaving
                    ? 'Saving conversation...'
                    : isNavigating
                      ? 'Navigating to chat...'
                      : 'Ending session...')}
                {connectionStatus === VOICE_STATES.CONNECTION.ERROR &&
                  'Connection error occurred'}
              </p>
              {!existingChatId && hasMessagesRef.current && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your conversation will be saved when you hang up
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                disabled={
                  connectionStatus !== VOICE_STATES.CONNECTION.CONNECTED ||
                  isSaving ||
                  isNavigating
                }
                className={cn(
                  isMuted &&
                    'bg-red-50 border-red-200 text-red-600 hover:bg-red-100',
                )}
              >
                {isMuted ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                disabled={
                  connectionStatus !== VOICE_STATES.CONNECTION.CONNECTED ||
                  isSaving ||
                  isNavigating
                }
              >
                {isPlaying ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Transcript */}
            {displayTranscript.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Conversation:
                </p>
                {displayTranscript.map((msg, index) => (
                  <p
                    key={`transcript-${index}`}
                    className={cn(
                      'text-xs',
                      msg.role === 'user' ? 'text-green-600' : 'text-blue-600',
                    )}
                  >
                    {msg.role === 'user' ? 'You: ' : 'AI: '}
                    {msg.content}
                  </p>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
