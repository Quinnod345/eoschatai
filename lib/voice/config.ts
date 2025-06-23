// Voice Mode Configuration

export const VOICE_CONFIG = {
  // WebRTC Configuration
  webrtc: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    model: 'gpt-4o-realtime-preview-2024-12-17',
    baseUrl: 'https://api.openai.com/v1/realtime',
  },

  // Audio Configuration
  audio: {
    input: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    format: {
      input: 'pcm16',
      output: 'pcm16',
    },
    analyser: {
      fftSize: 256,
    },
  },

  // Voice Configuration
  voice: {
    default: 'alloy',
    options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  },

  // Turn Detection (VAD)
  turnDetection: {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 200,
  },

  // Session Configuration
  session: {
    temperature: 0.8,
    maxResponseOutputTokens: 4096,
    transcriptionModel: 'whisper-1',
  },

  // UI Configuration
  ui: {
    maxTranscriptMessages: 5,
    navigationDelay: 1500, // ms to wait before navigating to new chat
    audioLevelThreshold: 0.1, // Minimum audio level to show visualization
  },

  // Feature Flags
  features: {
    useEnhancedVoiceMode: true,
    autoNavigateToChat: true,
    showPersonaInfo: true,
    showChatStatus: true,
  },
};

// Voice Mode Event Types
export const VOICE_EVENTS = {
  // Session Events
  SESSION_CREATED: 'session.created',
  SESSION_UPDATE: 'session.update',
  SESSION_END: 'session.end',

  // Audio Events
  SPEECH_STARTED: 'input_audio_buffer.speech_started',
  SPEECH_STOPPED: 'input_audio_buffer.speech_stopped',
  AUDIO_BUFFER_CLEAR: 'input_audio_buffer.clear',

  // Transcription Events
  USER_TRANSCRIPTION_COMPLETED:
    'conversation.item.input_audio_transcription.completed',
  USER_TRANSCRIPTION_DELTA: 'conversation.item.input_audio_transcription.delta',

  // Response Events
  RESPONSE_CREATED: 'response.created',
  RESPONSE_DONE: 'response.done',
  RESPONSE_TRANSCRIPT_DELTA: 'response.audio_transcript.delta',
  RESPONSE_TRANSCRIPT_DONE: 'response.audio_transcript.done',
  RESPONSE_AUDIO_STARTED: 'response.audio.started',
  RESPONSE_AUDIO_DONE: 'response.audio.done',

  // Conversation Events
  CONVERSATION_ITEM_CREATED: 'conversation.item.created',

  // Error Events
  ERROR: 'error',
} as const;

// Voice Mode States
export const VOICE_STATES = {
  CONNECTION: {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error',
  },
  SESSION: {
    IDLE: 'idle',
    INITIALIZING: 'initializing',
    READY: 'ready',
    ACTIVE: 'active',
    ENDING: 'ending',
  },
} as const;

// Helper function to get voice mode title
export function getVoiceModeTitle(content: string): string {
  // Extract first meaningful sentence or phrase
  const firstSentence = content.match(/^[^.!?]+[.!?]?/)?.[0] || content;

  // Truncate if too long
  const maxLength = 60;
  if (firstSentence.length > maxLength) {
    return firstSentence.substring(0, maxLength) + '...';
  }

  return firstSentence;
}

// Helper to determine if we should create a new chat
export function shouldCreateNewChat(
  existingChatId: string | undefined,
  isFirstMessage: boolean,
): boolean {
  return !existingChatId && isFirstMessage;
}
