'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/lib/toast-system';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/utils/secure-logger';

interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId?: string;
  selectedProviderId?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

const AUDIO_CONFIG: AudioConfig = {
  sampleRate: 24000,
  channels: 1,
  bitsPerSample: 16,
};

export default function VoiceMode({
  isOpen,
  onClose,
  selectedModelId,
  selectedProviderId,
}: VoiceModeProps) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const sessionRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Initialize WebSocket connection using ephemeral tokens (serverless)
  const initializeConnection = useCallback(async () => {
    if (connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return;
    }

    // Prevent infinite retries
    if (retryCountRef.current >= maxRetries) {
      console.error('Max retries reached, stopping connection attempts');
      toast.error('Unable to connect to voice service after multiple attempts');
      setConnectionStatus('error');
      return;
    }

    console.log(
      `Connection attempt ${retryCountRef.current + 1} of ${maxRetries}`,
    );
    retryCountRef.current++;

    setConnectionStatus('connecting');

    try {
      // Step 1: Create ephemeral session (serverless approach)
      
      const sessionResponse = await fetch('/api/voice/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(error.error || 'Failed to create voice session');
      }

      const session = await sessionResponse.json();
      sessionRef.current = session;

      const voiceLogger = createLogger('VoiceMode');
      voiceLogger.info('Ephemeral session created', {
        sessionId: session.id,
        hasClientSecret: !!session.client_secret,
      });

      // Step 2: Connect to OpenAI using client_secret as auth token
      const clientSecret = session.client_secret;
      if (!clientSecret || typeof clientSecret !== 'string') {
        throw new Error('Invalid client secret received from server');
      }

      // Connect using the ephemeral key
      voiceLogger.debug('Attempting WebSocket connection');

      // Connect to OpenAI Realtime API with ephemeral key
      // Try the exact format from VOICE-MODE-FIXES.md
      const ws = new WebSocket('wss://api.openai.com/v1/realtime', [
        `session.${session.id}`,
        `key.${clientSecret}`,
      ]);

      

      ws.onopen = () => {
        
        
        
        
        setConnectionStatus('connected');

        // Configure the session with our desired settings
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              model: 'gpt-4o-realtime-preview-2024-12-17',
              instructions:
                'You are a helpful EOS (Entrepreneurial Operating System) AI assistant. Respond conversationally and help users with EOS-related questions and implementation.',
              modalities: ['text', 'audio'],
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
              max_response_output_tokens: 'inf',
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeEvent(data);
        } catch (error) {
          console.error('Voice mode: Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(
          'Voice mode: WebSocket disconnected',
          event.code,
          event.reason || '(no reason provided)',
        );

        // Log close codes for debugging
        switch (event.code) {
          case 1006:
            console.error('Abnormal closure - no close frame received');
            break;
          case 1000:
            
            break;
          case 1001:
            
            break;
          case 1002:
            
            break;
          case 1003:
            
            break;
          default:
            
        }

        setConnectionStatus('disconnected');
        setIsListening(false);
      };

      ws.onerror = (error) => {
        console.error('Voice mode: WebSocket error:', error);
        console.error('Voice mode: Connection URL:', ws.url);
        console.error('Voice mode: Ready state:', ws.readyState);
        console.error('Voice mode: Session ID:', session.id);
        console.error(
          'Voice mode: Token (first 10 chars):',
          `${clientSecret.substring(0, 10)}...`,
        );
        console.error('Voice mode: Subprotocols:', ws.protocol);
        console.error('Voice mode: Extensions:', ws.extensions);
        setConnectionStatus('error');
        toast.error('Voice connection failed - check console for details');
      };

      wsRef.current = ws;
    } catch (error: any) {
      console.error('Voice mode: Connection error:', error);
      setConnectionStatus('error');
      toast.error(error.message || 'Failed to initialize voice mode');
    }
  }, [connectionStatus]);

  // Handle real-time events from OpenAI
  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'session.created':
        
        break;

      case 'session.updated':
        
        break;

      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event?.transcript) {
          setTranscript((prev) => [...prev, `User: ${event.transcript}`]);
        }
        break;

      case 'response.audio.delta':
        if (event?.delta) {
          // Queue audio data for playback
          const audioData = base64ToArrayBuffer(event.delta);
          audioQueueRef.current.push(audioData);
          if (!isPlayingRef.current) {
            playAudioQueue();
          }
        }
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
        }
        break;

      case 'response.done':
        
        break;

      case 'error': {
        console.error('Voice mode: API error:', event.error || event);
        const errorMessage =
          event?.error?.message ||
          JSON.stringify(event?.error) ||
          'Unknown error occurred';

        // Handle different error types
        const errorString =
          typeof errorMessage === 'string' ? errorMessage : '';
        if (errorString.includes('session_expired')) {
          toast.error('Voice session expired. Please reconnect.');
          setConnectionStatus('error');
        } else if (errorString.includes('invalid_session')) {
          toast.error('Invalid session. Please try again.');
          setConnectionStatus('error');
        } else {
          toast.error(`Voice error: ${errorMessage}`);
          setConnectionStatus('error');
        }
        break;
      }

      default:
        // Log unknown events for debugging
        
        break;
    }
  }, []);

  // Convert base64 to ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Play queued audio
  const playAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    try {
      const audioContext = new AudioContext({
        sampleRate: AUDIO_CONFIG.sampleRate,
      });

      while (audioQueueRef.current.length > 0) {
        const audioData = audioQueueRef.current.shift();
        if (!audioData) break;

        // Convert PCM16 data to audio buffer
        const pcmData = new Int16Array(audioData);
        const audioBuffer = audioContext.createBuffer(
          AUDIO_CONFIG.channels,
          pcmData.length,
          AUDIO_CONFIG.sampleRate,
        );

        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0; // Convert to float
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        // Play audio and wait for completion
        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      }
    } catch (error) {
      console.error('Voice mode: Audio playback error:', error);
    } finally {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  };

  // Initialize microphone
  const initializeMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis for visual feedback
      const audioContext = new AudioContext({
        sampleRate: AUDIO_CONFIG.sampleRate,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up audio processor for PCM16 conversion
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = convertFloat32ToPCM16(inputData);
          const base64Audio = arrayBufferToBase64(pcm16);

          wsRef.current.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Audio,
            }),
          );
        }
      };

      // Start audio level monitoring
      monitorAudioLevel();
    } catch (error) {
      console.error('Voice mode: Microphone access error:', error);
      toast.error('Could not access microphone');
    }
  }, []);

  // Convert Float32 audio to PCM16
  const convertFloat32ToPCM16 = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // Convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Monitor audio level for visual feedback
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
    await initializeMicrophone();
  };

  // Stop voice session
  const stopVoiceSession = () => {
    // Stop audio processing
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('disconnected');
    setIsListening(false);
    setAudioLevel(0);
    sessionRef.current = null;
  };

  // Toggle mute
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  // Initialize when component opens
  useEffect(() => {
    if (isOpen && connectionStatus === 'disconnected') {
      retryCountRef.current = 0; // Reset retry count when opening
      startVoiceSession();
    }

    return () => {
      if (!isOpen) {
        retryCountRef.current = 0; // Reset retry count when closing
        stopVoiceSession();
      }
    };
  }, [isOpen, connectionStatus]);

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
            onClick={onClose}
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
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose}>
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

                {/* Development Test Button */}
                {isDevelopment && (
                  <div className="text-center mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          console.log(
                            'Testing with direct API key (DEV ONLY)...',
                          );
                          const response = await fetch('/api/voice/direct', {
                            method: 'POST',
                          });
                          const data = await response.json();

                          if (data.apiKey) {
                            const ws = new WebSocket(
                              'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
                              [`openai-insecure-api-key.${data.apiKey}`],
                            );

                            ws.onopen = () => {
                              console.log(
                                'DEV: Connected with direct API key!',
                              );
                              toast.success(
                                'Connected using direct API key (DEV ONLY)',
                              );
                            };

                            ws.onerror = (error) => {
                              console.error(
                                'DEV: Direct connection failed:',
                                error,
                              );
                            };

                            ws.onclose = (event) => {
                              console.log(
                                'DEV: Connection closed:',
                                event.code,
                                event.reason,
                              );
                            };
                          }
                        } catch (error) {
                          console.error('DEV test error:', error);
                        }
                      }}
                      className="text-xs"
                    >
                      Test Direct Connection (Dev Only)
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      For debugging WebSocket issues
                    </p>
                  </div>
                )}

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
