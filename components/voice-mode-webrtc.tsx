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

export default function VoiceModeWebRTC({
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

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);

  // Initialize WebRTC connection using ephemeral tokens
  const initializeConnection = useCallback(async () => {
    if (connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return;
    }

    setConnectionStatus('connecting');

    try {
      const voiceLogger = createLogger('VoiceWebRTC');

      // Step 1: Create ephemeral session
      voiceLogger.debug('Creating ephemeral voice session');
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
      voiceLogger.info('Ephemeral session created', {
        sessionId: session.id,
        hasClientSecret: !!session.client_secret,
      });

      // Step 2: Get user media
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

      // Step 3: Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      // Add audio track
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create data channel for messages
      const dataChannel = pc.createDataChannel('messages', {
        ordered: true,
      });
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log('Data channel opened');
        setConnectionStatus('connected');

        // Send initial configuration
        dataChannel.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              model: 'gpt-4o-realtime-preview',
              instructions: 'You are a helpful EOS AI assistant.',
              modalities: ['text', 'audio'],
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              turn_detection: {
                type: 'server_vad',
              },
            },
          }),
        );
      };

      dataChannel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeEvent(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI with ephemeral token
      const response = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.client_secret}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: 'alloy',
          sdp: offer.sdp,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.status}`);
      }

      const answer = await response.json();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answer.sdp,
      });

      // Set up audio analysis
      const audioContext = new AudioContext({
        sampleRate: AUDIO_CONFIG.sampleRate,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      monitorAudioLevel();
    } catch (error: any) {
      console.error('Voice mode: Connection error:', error);
      setConnectionStatus('error');
      toast.error(error.message || 'Failed to initialize voice mode');
    }
  }, [connectionStatus]);

  // Handle real-time events
  const handleRealtimeEvent = useCallback((event: any) => {
    const voiceLogger = createLogger('VoiceWebRTC');
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        voiceLogger.debug('Session event', { type: event.type });
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

      case 'error':
        console.error('Voice error:', event.error);
        toast.error(`Voice error: ${event.error?.message || 'Unknown error'}`);
        break;

      default:
        console.log('Voice event:', event.type);
    }
  }, []);

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

  // Start voice session
  const startVoiceSession = async () => {
    await initializeConnection();
  };

  // Stop voice session
  const stopVoiceSession = () => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
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
      startVoiceSession();
    }

    return () => {
      if (!isOpen) {
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
                    <h2 className="text-xl font-semibold">
                      Voice Mode (WebRTC)
                    </h2>
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
