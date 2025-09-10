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
import { toast } from '@/lib/toast-system';
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
  navigateToChat?: boolean;
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
}

export default function VoiceModeFixed({
  isOpen,
  onClose,
  selectedModelId,
  selectedProviderId,
  selectedPersonaId,
  selectedProfileId,
  chatId: existingChatId,
  onMessagesUpdate,
  onChatCreated,
  navigateToChat = false,
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

  // Session management
  const [sessionChatId, setSessionChatId] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);
  const chatCreatedRef = useRef(false);

  // Message tracking - using refs for stable access in event handlers
  const messagesRef = useRef<VoiceMessage[]>([]);
  const pendingUserMessageRef = useRef<VoiceMessage | null>(null);
  const pendingAssistantMessageRef = useRef<VoiceMessage | null>(null);

  // Message save queue to ensure proper ordering
  const messageSaveQueueRef = useRef<VoiceMessage[]>([]);
  const isSavingRef = useRef(false);

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
    if (sessionChatId) {
      return sessionChatId;
    }
    const newId = generateUUID();
    setSessionChatId(newId);
    return newId;
  }, [existingChatId, sessionChatId]);

  // Process message save queue
  const processMessageQueue = useCallback(async () => {
    if (isSavingRef.current || messageSaveQueueRef.current.length === 0) {
      return;
    }

    isSavingRef.current = true;
    const message = messageSaveQueueRef.current.shift()!;

    const chatId = getSessionChatId();

    console.log('[Voice Mode] Processing message from queue:', {
      chatId,
      messageId: message.id,
      messageRole: message.role,
      queueLength: messageSaveQueueRef.current.length,
    });

    try {
      const response = await fetch('/api/voice/messages', {
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

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        console.error('[Voice Mode] Failed to save message:', errorData);
      } else {
        const responseData = await response.json();
        console.log('[Voice Mode] Message saved successfully:', {
          ...responseData,
          messageRole: message.role,
          messageId: message.id,
        });

        // Handle chat creation - only on first user message
        if (
          responseData.chatCreated &&
          message.role === 'user' &&
          !chatCreatedRef.current
        ) {
          chatCreatedRef.current = true;
          console.log('[Voice Mode] New chat created:', responseData.chatId);

          // Update session chat ID
          setSessionChatId(responseData.chatId);

          // Update sidebar
          try {
            await mutate(unstable_serialize(getChatHistoryPaginationKey));
          } catch (e) {
            console.error('[Voice Mode] Error updating sidebar:', e);
          }

          // Notify parent
          if (onChatCreated) {
            onChatCreated(responseData.chatId);
          }

          // Handle navigation if requested
          if (navigateToChat && !hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            console.log('[Voice Mode] Will navigate after modal closes');
            // We'll navigate when modal closes to prevent issues
          }
        }
      }
    } catch (error) {
      console.error('[Voice Mode] Error saving message:', error);
    } finally {
      isSavingRef.current = false;
      // Process next message in queue
      if (messageSaveQueueRef.current.length > 0) {
        setTimeout(processMessageQueue, 100);
      }
    }
  }, [
    getSessionChatId,
    selectedPersonaId,
    selectedProfileId,
    selectedProviderId,
    mutate,
    onChatCreated,
    navigateToChat,
  ]);

  // Save message helper
  const saveMessage = useCallback(
    (message: VoiceMessage) => {
      console.log('[Voice Mode] Queueing message for save:', {
        id: message.id,
        role: message.role,
        contentLength: message.content.length,
      });

      // Add to messages list
      messagesRef.current.push(message);

      // Update UI if callback provided
      if (onMessagesUpdate) {
        onMessagesUpdate(
          messagesRef.current.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: new Date(m.timestamp),
            parts: [{ type: 'text', text: m.content }],
          })),
        );
      }

      // Queue for save
      messageSaveQueueRef.current.push(message);
      processMessageQueue();
    },
    [onMessagesUpdate, processMessageQueue],
  );

  // Initialize WebRTC connection
  const initializeConnection = useCallback(async () => {
    if (
      connectionStatus !== VOICE_STATES.CONNECTION.DISCONNECTED ||
      sessionState !== VOICE_STATES.SESSION.IDLE
    ) {
      return;
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
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = event.streams[0];
        }
      };

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: VOICE_CONFIG.audio.input,
      });
      mediaStreamRef.current = stream;

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
        console.log('[Voice Mode] Data channel opened');
        setConnectionStatus(VOICE_STATES.CONNECTION.CONNECTED);
        setSessionState(VOICE_STATES.SESSION.READY);
        customToast.success('Voice mode ready');

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
      const offer = await pc.createOffer();
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
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      console.log('[Voice Mode] WebRTC connection established');
    } catch (error: any) {
      console.error('[Voice Mode] Connection error:', error);
      setConnectionStatus(VOICE_STATES.CONNECTION.ERROR);
      setSessionState(VOICE_STATES.SESSION.IDLE);
      toast.error(error.message || 'Failed to connect to voice service');
    }
  }, [
    connectionStatus,
    sessionState,
    getSessionChatId,
    selectedPersonaId,
    selectedProfileId,
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
          // Handle interruption
          if (
            pendingAssistantMessageRef.current &&
            !pendingAssistantMessageRef.current.isComplete &&
            pendingAssistantMessageRef.current.content.trim()
          ) {
            console.log('[Voice Mode] User interrupted assistant');
            const interrupted = {
              ...pendingAssistantMessageRef.current,
              content:
                pendingAssistantMessageRef.current.content + ' [interrupted]',
              isComplete: true,
            };
            saveMessage(interrupted);
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
            const userMessage: VoiceMessage = {
              id: generateUUID(),
              role: 'user',
              content: event.transcript,
              timestamp: Date.now(),
              isComplete: true,
            };
            pendingUserMessageRef.current = userMessage;
            saveMessage(userMessage);
          }
          break;

        case VOICE_EVENTS.RESPONSE_CREATED:
          console.log('[Voice Mode] Response created');
          const newAssistant: VoiceMessage = {
            id: generateUUID(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isComplete: false,
          };
          pendingAssistantMessageRef.current = newAssistant;
          break;

        case VOICE_EVENTS.RESPONSE_TRANSCRIPT_DELTA:
          if (event?.delta && pendingAssistantMessageRef.current) {
            pendingAssistantMessageRef.current.content += event.delta;
            // Update UI in real-time
            if (onMessagesUpdate) {
              const allMessages = [
                ...messagesRef.current,
                pendingAssistantMessageRef.current,
              ];
              onMessagesUpdate(
                allMessages.map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  createdAt: new Date(m.timestamp),
                  parts: [{ type: 'text', text: m.content }],
                })),
              );
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
            saveMessage(completed);
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
    [saveMessage, sendEvent, onMessagesUpdate],
  );

  // Monitor audio level
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      const average =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(average / 255);

      requestAnimationFrame(updateLevel);
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

  // Stop voice session
  const stopVoiceSession = useCallback(() => {
    console.log('[Voice Mode] Stopping session');
    setSessionState(VOICE_STATES.SESSION.ENDING);

    // Clean up resources
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
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

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset state
    handleDisconnection();
    messagesRef.current = [];
    pendingUserMessageRef.current = null;
    pendingAssistantMessageRef.current = null;
    messageSaveQueueRef.current = [];
    isSavingRef.current = false;
    analyserRef.current = null;

    // Handle navigation after cleanup if needed
    if (navigateToChat && hasNavigatedRef.current && sessionChatId) {
      console.log('[Voice Mode] Navigating to chat after cleanup');
      router.push(`/chat/${sessionChatId}`);
    }
  }, [navigateToChat, sessionChatId, router]);

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
      // Reset flags
      hasNavigatedRef.current = false;
      chatCreatedRef.current = false;
      const timer = setTimeout(() => {
        initializeConnection();
      }, 100);
      return () => clearTimeout(timer);
    } else if (
      !isOpen &&
      connectionStatus !== VOICE_STATES.CONNECTION.DISCONNECTED
    ) {
      stopVoiceSession();
    }
  }, [isOpen, connectionStatus, initializeConnection, stopVoiceSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionStatus !== VOICE_STATES.CONNECTION.DISCONNECTED) {
        stopVoiceSession();
      }
    };
  }, []);

  if (!isOpen) return null;

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
          // Only close if clicking directly on the backdrop
          if (e.target === e.currentTarget) {
            stopVoiceSession();
            onClose();
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
                        {existingChatId ? 'In chat' : 'Chat created'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  stopVoiceSession();
                  onClose();
                }}
              >
                <PhoneOff className="h-4 w-4" />
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
                  'Ending session...'}
                {connectionStatus === VOICE_STATES.CONNECTION.ERROR &&
                  'Connection error occurred'}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                disabled={
                  connectionStatus !== VOICE_STATES.CONNECTION.CONNECTED
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
                  connectionStatus !== VOICE_STATES.CONNECTION.CONNECTED
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
