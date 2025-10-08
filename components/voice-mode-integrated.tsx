'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast as customToast } from '@/lib/toast-system';
import { cn } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
import { useRouter } from 'next/navigation';
interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId?: string;
  selectedProviderId?: string;
  selectedPersonaId?: string;
  selectedProfileId?: string;
  chatId?: string;
  onMessagesUpdate?: (messages: any[]) => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function VoiceModeIntegrated({
  isOpen,
  onClose,
  selectedModelId,
  selectedProviderId,
  selectedPersonaId,
  selectedProfileId,
  chatId,
  onMessagesUpdate,
}: VoiceModeProps) {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    personaName?: string;
    profileName?: string;
  } | null>(null);
  const [currentUserMessage, setCurrentUserMessage] = useState<{
    id: string;
    content: string;
    timestamp: number;
  } | null>(null);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState<{
    id: string;
    content: string;
    timestamp: number;
  } | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [newChatId, setNewChatId] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const instructionsRef = useRef<string | null>(null);

  // Initialize WebRTC connection
  const initializeConnection = useCallback(async () => {
    if (connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return;
    }

    // For new voice sessions, generate a proper chat ID
    let currentChatId = chatId;
    if (!currentChatId) {
      currentChatId = generateUUID(); // Use a proper UUID, not temp prefix
      setNewChatId(currentChatId);
      console.log('Voice Mode: Generated new chat ID:', currentChatId);
    } else {
      console.log('Voice Mode: Using existing chat ID:', currentChatId);
    }

    console.log(
      'Voice Mode: Initializing connection with chatId:',
      currentChatId,
    );
    setConnectionStatus('connecting');

    try {
      // Step 1: Get ephemeral token from server
      console.log('Getting ephemeral token...', {
        selectedPersonaId,
        selectedProfileId,
        chatId: currentChatId,
      });
      const tokenResponse = await fetch('/api/voice/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedPersonaId: selectedPersonaId || undefined,
          selectedProfileId: selectedProfileId || undefined,
          chatId: currentChatId,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get session token');
      }

      const tokenData = await tokenResponse.json();
      const ephemeralKey = tokenData.client_secret;
      instructionsRef.current = tokenData.instructions;
      setSessionInfo({
        personaName: tokenData.personaName,
        profileName: tokenData.profileName,
      });
      console.log('Got ephemeral token and instructions');

      // Step 2: Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      // Step 3: Set up audio element for remote audio
      audioElementRef.current = document.createElement('audio');
      audioElementRef.current.autoplay = true;

      pc.ontrack = (event) => {
        console.log('Received remote audio track');
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = event.streams[0];
        }
      };

      // Step 4: Get user media and add track
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
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
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      monitorAudioLevel();

      // Step 5: Create data channel
      const dataChannel = pc.createDataChannel('oai-events', {
        ordered: true,
      });
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log('Data channel opened');
        setConnectionStatus('connected');

        // Connection established
        console.log('Voice Mode: Connection established');
        customToast.success('Voice mode connected');

        // Send initial configuration with custom instructions
        sendEvent({
          type: 'session.update',
          session: {
            instructions:
              instructionsRef.current ||
              'You are a helpful EOS (Entrepreneurial Operating System) AI assistant. Respond conversationally and help users with EOS-related questions and implementation.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,
            },
            tools: [],
            temperature: 0.8,
            max_response_output_tokens: 4096,
          },
        });
      };

      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeEvent(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
        // Don't let errors bubble up and cause page issues
        error.preventDefault?.();
      };

      dataChannel.onclose = () => {
        console.log('Data channel closed');
        setConnectionStatus('disconnected');
      };

      // Step 6: Create offer and connect
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';

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

      console.log('WebRTC connection established');
    } catch (error: any) {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      customToast.error(error.message || 'Failed to connect to voice service');
    }
  }, [connectionStatus, selectedPersonaId, selectedProfileId, chatId]);

  // Send event through data channel
  const sendEvent = useCallback((event: any) => {
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === 'open'
    ) {
      event.event_id = event.event_id || crypto.randomUUID();
      dataChannelRef.current.send(JSON.stringify(event));
    }
  }, []);

  // Save messages to database
  const saveMessagesToDB = useCallback(
    async (
      userMsg?: { id: string; content: string; timestamp: number },
      assistantMsg?: { id: string; content: string; timestamp: number },
    ) => {
      // Use the newChatId if we generated one, otherwise use the existing chatId
      const actualChatId = newChatId || chatId;

      // Only save to DB if we have a real chat ID
      if (actualChatId) {
        console.log('Voice Mode: Saving message to chat:', actualChatId);

        try {
          const response = await fetch('/api/voice/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chatId: actualChatId,
              userMessage: userMsg,
              assistantMessage: assistantMsg,
              selectedPersonaId,
              selectedProfileId,
              provider: selectedProviderId || 'openai',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to save voice messages:', errorData);
          } else {
            console.log('Voice messages saved successfully');

            // Navigate to the new chat if this is the first message and we're not already there
            if (userMsg && !assistantMsg && newChatId && !hasNavigated) {
              console.log('Voice Mode: Navigating to new chat:', newChatId);
              setHasNavigated(true);
              // Use window.location for a full page navigation to ensure proper chat initialization
              window.location.href = `/chat/${newChatId}`;
            }
          }
        } catch (error) {
          console.error('Error saving voice messages:', error);
        }
      }
    },
    [
      chatId,
      newChatId,
      hasNavigated,
      selectedPersonaId,
      selectedProfileId,
      selectedProviderId,
    ],
  );

  // Handle incoming events
  const handleRealtimeEvent = useCallback(
    (event: any) => {
      switch (event.type) {
        case 'session.created':
        case 'session.updated':
          console.log('Session event:', event.type);
          break;

        case 'input_audio_buffer.speech_started':
          setIsListening(true);
          // If there's an ongoing assistant message, save it as interrupted
          if (currentAssistantMessage?.content.trim()) {
            console.log(
              'Voice Mode: User interrupted, saving partial assistant response',
            );
            saveMessagesToDB(undefined, {
              ...currentAssistantMessage,
              content: `${currentAssistantMessage.content} [interrupted]`,
            });
            setCurrentAssistantMessage(null);
          }
          break;

        case 'input_audio_buffer.speech_stopped':
          setIsListening(false);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          console.log('Voice Mode: Transcription completed event:', {
            hasTranscript: !!event?.transcript,
            hasItemId: !!event?.item_id,
            itemRole: event?.item?.role,
            fullEvent: event,
          });
          // Process user message transcription
          if (event?.transcript && event?.item_id) {
            console.log(
              'Voice Mode: User transcription completed:',
              event.transcript,
            );
            setTranscript((prev) => [...prev, `User: ${event.transcript}`]);
            // Create user message
            const userMsg = {
              id: event.item_id || generateUUID(), // Use OpenAI's item_id if available
              content: event.transcript,
              timestamp: Date.now(),
            };
            setCurrentUserMessage(userMsg);

            // Add message to chat UI on next tick
            setTimeout(() => {
              const actualChatId = newChatId || chatId;
              console.log(
                'Voice Mode: Attempting to update messages, onMessagesUpdate:',
                !!onMessagesUpdate,
                'chatId:',
                actualChatId,
              );
              if (onMessagesUpdate && actualChatId) {
                const uiMessage = {
                  id: userMsg.id,
                  role: 'user',
                  content: userMsg.content,
                  createdAt: new Date(userMsg.timestamp),
                  parts: [
                    {
                      type: 'text',
                      text: userMsg.content,
                    },
                  ],
                };
                console.log('Voice Mode: Adding user message:', uiMessage);
                onMessagesUpdate([uiMessage]);
              } else {
                console.warn(
                  'Voice Mode: Cannot update messages - missing callback or chatId',
                );
              }
            }, 0);

            // Also save to database
            saveMessagesToDB(userMsg, undefined);
          }
          break;

        case 'response.created':
          // A new response is starting, clear any existing assistant message
          console.log('Voice Mode: New response created');
          setCurrentAssistantMessage(null);
          break;

        case 'response.audio_transcript.delta':
          if (event?.delta) {
            setTranscript((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.startsWith('AI: ')) {
                const updated = [...prev];
                updated[updated.length - 1] = lastMessage + event.delta;
                return updated;
              } else {
                return [...prev, `AI: ${event.delta}`];
              }
            });

            // Update current assistant message
            setCurrentAssistantMessage((prev) => {
              // Check if we need a new message (no prev means new response)
              if (!prev) {
                // This is a new response, create a new message with new ID
                const newMsgId = generateUUID();
                const newMsg = {
                  id: newMsgId,
                  content: event.delta,
                  timestamp: Date.now(),
                };

                // Add the new message to chat UI
                setTimeout(() => {
                  const actualChatId = newChatId || chatId;
                  if (onMessagesUpdate && actualChatId) {
                    const uiMessage = {
                      id: newMsgId,
                      role: 'assistant',
                      content: newMsg.content,
                      createdAt: new Date(newMsg.timestamp),
                      parts: [
                        {
                          type: 'text',
                          text: newMsg.content,
                        },
                      ],
                    };
                    onMessagesUpdate([uiMessage]);
                  }
                }, 0);

                return newMsg;
              } else {
                // Update existing message
                const updatedMsg = {
                  ...prev,
                  content: prev.content + event.delta,
                };

                // Schedule UI update for next tick to avoid updating during render
                setTimeout(() => {
                  const actualChatId = newChatId || chatId;
                  if (onMessagesUpdate && actualChatId) {
                    const uiMessage = {
                      id: prev.id,
                      role: 'assistant',
                      content: updatedMsg.content,
                      createdAt: new Date(prev.timestamp),
                      parts: [
                        {
                          type: 'text',
                          text: updatedMsg.content,
                        },
                      ],
                    };
                    onMessagesUpdate([uiMessage]);
                  }
                }, 0);

                return updatedMsg;
              }
            });
          }
          break;

        case 'response.audio.started':
          setIsPlaying(true);
          // When audio starts, ensure we have a clean slate for the new response
          console.log('Voice Mode: Audio response started');
          break;

        case 'response.audio.done':
          setIsPlaying(false);
          break;

        case 'response.done':
          // Response is completely done, save the assistant message
          if (currentAssistantMessage?.content.trim()) {
            console.log(
              'Voice Mode: Response done, saving assistant message:',
              currentAssistantMessage.content,
            );
            saveMessagesToDB(undefined, currentAssistantMessage);
            setCurrentAssistantMessage(null);
          }
          break;

        case 'response.audio_transcript.done':
          // Audio transcript is done, but wait for response.done to save
          console.log(
            'Voice Mode: Audio transcript done, waiting for response.done',
          );
          break;

        case 'error':
          console.error('Realtime API error:', event.error);
          customToast.error(
            `Voice error: ${event.error?.message || 'Unknown error'}`,
          );
          break;

        case 'conversation.item.input_audio_transcription.delta':
          // Ignore user transcript deltas - we only process completed transcripts
          console.log(
            'Voice Mode: Ignoring user transcript delta:',
            event?.delta,
          );
          break;

        case 'conversation.item.created':
          // Handle conversation item creation to track what type of message it is
          if (event?.item) {
            console.log('Voice Mode: Conversation item created:', event.item);
            if (
              event.item.type === 'message' &&
              event.item.role === 'assistant'
            ) {
              // This is a new assistant message starting
              console.log('Voice Mode: New assistant message starting');
              setCurrentAssistantMessage(null);
            }
          }
          break;

        default:
          console.log('Realtime event:', event.type, event);
          // Log any transcript-related events we might be missing
          if (event.type?.includes('transcript')) {
            console.log('Transcript event details:', event);
            // Check if this is a transcript event we should ignore
            if (
              event.type === 'conversation.item.input_audio_transcription.delta'
            ) {
              console.log('Ignoring transcript delta for input audio');
            }
          }
      }
    },
    [
      currentAssistantMessage,
      saveMessagesToDB,
      onMessagesUpdate,
      chatId,
      newChatId,
    ],
  );

  // Monitor audio level for visualization
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

  // Start voice session
  const startVoiceSession = async () => {
    await initializeConnection();
  };

  // Stop voice session
  const stopVoiceSession = () => {
    console.log('Stopping voice session...');

    // Send session end event before closing
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === 'open'
    ) {
      try {
        sendEvent({
          type: 'session.end',
        });
      } catch (e) {
        console.error('Error sending session end event:', e);
      }
    }

    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Stop media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      mediaStreamRef.current = null;
    }

    // Clean up audio element
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      // Remove all transceivers
      peerConnectionRef.current.getTransceivers().forEach((transceiver) => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset all state
    setConnectionStatus('disconnected');
    setIsListening(false);
    setIsPlaying(false);
    setAudioLevel(0);
    setTranscript([]);
    setCurrentUserMessage(null);
    setCurrentAssistantMessage(null);
    setHasNavigated(false);
    setNewChatId(null);
    analyserRef.current = null;
  };

  // Toggle mute
  const toggleMute = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);

      // Notify the model about mute status
      sendEvent({
        type: 'input_audio_buffer.clear',
      });
    }
  };

  // Handle modal open/close
  useEffect(() => {
    if (isOpen && connectionStatus === 'disconnected') {
      // Reset states for new session
      console.log('Voice Mode: Modal opened, chatId:', chatId);

      // Start voice session after a brief delay to ensure everything is ready
      const timeoutId = setTimeout(() => {
        startVoiceSession();
      }, 100);

      // Clean up timeout on unmount
      return () => clearTimeout(timeoutId);
    } else if (!isOpen && connectionStatus !== 'disconnected') {
      // Stop session when modal closes
      stopVoiceSession();
    }
  }, [isOpen]); // Remove chatId from dependencies to avoid re-triggering

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  // Only render if we're in the browser
  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
            onClick={() => {
              stopVoiceSession();
              onClose();
            }}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md pointer-events-auto"
            >
              <Card className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Voice Mode</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          connectionStatus === 'connected'
                            ? 'default'
                            : 'secondary'
                        }
                        className={cn(
                          connectionStatus === 'connected' &&
                            'bg-green-500 hover:bg-green-600',
                          connectionStatus === 'connecting' &&
                            'bg-yellow-500 hover:bg-yellow-600',
                          connectionStatus === 'error' &&
                            'bg-red-500 hover:bg-red-600',
                        )}
                      >
                        {connectionStatus === 'connected' && 'Connected'}
                        {connectionStatus === 'connecting' && 'Connecting...'}
                        {connectionStatus === 'disconnected' && 'Disconnected'}
                        {connectionStatus === 'error' && 'Error'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        WebRTC Mode
                      </span>
                      {sessionInfo?.personaName && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            •
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {sessionInfo.personaName}
                            {sessionInfo.profileName &&
                              ` - ${sessionInfo.profileName}`}
                          </span>
                        </>
                      )}
                      {chatId && !chatId.startsWith('temp-') && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            •
                          </span>
                          <span className="text-xs text-green-600 font-medium">
                            {chatId ? 'Saving to chat' : 'New chat created'}
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
                      {isMuted ? (
                        <MicOff className="h-8 w-8 text-white" />
                      ) : (
                        <Mic className="h-8 w-8 text-white" />
                      )}
                    </div>

                    {/* Audio level rings */}
                    {audioLevel > 0.1 && (
                      <>
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-white/30"
                          animate={{
                            scale: 1 + audioLevel * 0.5,
                            opacity: 0.7 - audioLevel * 0.3,
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 30,
                          }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-white/20"
                          animate={{
                            scale: 1 + audioLevel * 0.8,
                            opacity: 0.5 - audioLevel * 0.2,
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 30,
                          }}
                        />
                      </>
                    )}
                  </motion.div>
                </div>

                {/* Status */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {connectionStatus === 'connected' &&
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
                    {connectionStatus === 'connecting' &&
                      'Connecting to voice service...'}
                    {connectionStatus === 'disconnected' &&
                      'Voice service disconnected'}
                    {connectionStatus === 'error' &&
                      'Connection error occurred'}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleMute}
                    disabled={connectionStatus !== 'connected'}
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
                    disabled={connectionStatus !== 'connected'}
                  >
                    {isPlaying ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Transcript */}
                {transcript.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Conversation:
                    </p>
                    {transcript.slice(-3).map((line, index) => (
                      <p
                        key={`transcript-${Date.now()}-${index}-${line.slice(0, 10)}`}
                        className="text-xs"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
