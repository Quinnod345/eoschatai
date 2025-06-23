# Voice Mode Setup and Usage Guide

## 🎤 Overview

The Voice Mode feature enables real-time speech-to-speech conversations with your EOS AI assistant using OpenAI's Realtime API. Users can speak naturally and receive spoken responses, creating a more interactive and accessible experience.

## 🚀 Features

- **Real-time Speech Recognition**: Uses OpenAI's advanced speech recognition
- **Natural Voice Responses**: AI responds with natural-sounding speech
- **Visual Feedback**: Animated microphone with audio level visualization
- **Connection Status**: Clear indicators for connection state
- **Live Transcription**: See what you and the AI are saying in real-time
- **EOS-Optimized**: Configured specifically for EOS-related conversations

## 📋 Prerequisites

### 1. OpenAI API Access
- OpenAI API key with access to the Realtime API
- Ensure your OpenAI account has the necessary permissions for `gpt-4o-realtime-preview`

### 2. Environment Variables
Add your OpenAI API key to your environment variables:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Browser Requirements
- Modern browser with WebRTC support
- Microphone permissions
- Secure context (HTTPS) for microphone access

## 🛠️ Setup Instructions

### 1. Install Dependencies
The voice mode uses the OpenAI JavaScript SDK with realtime features:

```bash
npm install openai
```

### 2. Configure API Route
The voice configuration endpoint is automatically set up at `/api/voice/config` and will:
- Verify user authentication
- Return the OpenAI API key for client-side WebSocket connection
- Handle configuration errors gracefully

### 3. Component Integration
Voice mode is integrated in two ways:

#### Header Button
- Available in the chat header when logged in
- Click the "Voice" button to open the voice modal

#### Floating Action Button (FAB)
- Appears as a floating orange microphone button
- Positioned in the bottom-right corner
- Only visible for authenticated users in non-readonly chats

## 🎯 Usage Instructions

### Starting a Voice Conversation
1. **Click Voice Button**: Either from the header or the floating action button
2. **Grant Permissions**: Allow microphone access when prompted
3. **Wait for Connection**: The status badge will show "Connected" when ready
4. **Start Speaking**: Begin talking naturally about EOS topics

### During Conversation
- **Visual Feedback**: The microphone icon shows when you're speaking (green) vs when AI is responding (orange)
- **Audio Levels**: Concentric rings appear around the microphone based on your voice volume
- **Live Transcript**: See the conversation in real-time at the bottom of the modal
- **Interruption**: You can interrupt the AI by speaking at any time

### Controls
- **Mute/Unmute**: Toggle microphone on/off
- **Volume**: Control AI voice output (visual indicator only)
- **Close**: End the voice session

## 🎨 Customization

### Voice Settings
The voice mode is configured with:
- **Voice**: `alloy` (OpenAI's natural-sounding voice)
- **Input Format**: PCM16 at 24kHz
- **Output Format**: PCM16 at 24kHz
- **Voice Activity Detection**: Server-side with optimized thresholds

### Visual Customization
The VoiceFAB component supports different variants:
```tsx
<VoiceFAB
  variant="floating" // floating | inline | minimal
  size="lg"         // sm | md | lg
  showLabel={false} // Show/hide text label
/>
```

## 🔧 Technical Details

### Architecture
1. **WebSocket Connection**: Direct connection to OpenAI's Realtime API
2. **Audio Processing**: Browser MediaRecorder API for input, Web Audio API for output
3. **Real-time Streaming**: Bidirectional audio streaming with low latency
4. **State Management**: React hooks for connection, audio, and UI state

### Audio Pipeline
1. **Input**: Microphone → MediaRecorder → Base64 encoding → OpenAI
2. **Output**: OpenAI → Base64 audio → Web Audio API → Speakers
3. **Processing**: Real-time audio level analysis for visual feedback

### Error Handling
- **Connection Errors**: Graceful fallback with user feedback
- **Microphone Issues**: Clear error messages and troubleshooting
- **API Errors**: Automatic retry logic and status updates

## 🛡️ Security Considerations

### API Key Handling
- API keys are fetched server-side with authentication
- Keys are not stored in browser storage
- Connection requires valid user session

### Microphone Permissions
- Explicit user consent required
- Permissions can be revoked at any time
- Audio is only transmitted when voice mode is active

## 🐛 Troubleshooting

### Common Issues

#### "Voice service not configured"
- **Cause**: Missing or invalid OpenAI API key
- **Solution**: Verify `OPENAI_API_KEY` environment variable

#### "Could not access microphone"
- **Cause**: Browser permissions or HTTPS requirement
- **Solution**: 
  - Grant microphone permissions
  - Ensure site is served over HTTPS
  - Check browser compatibility

#### "Voice connection failed"
- **Cause**: Network issues or API rate limits
- **Solution**:
  - Check internet connection
  - Verify OpenAI API status
  - Check API usage limits

#### Poor Audio Quality
- **Cause**: Network bandwidth or browser audio settings
- **Solution**:
  - Check network stability
  - Close other audio applications
  - Try refreshing the page

### Debug Information
Enable debug logging by checking browser console for:
- WebSocket connection status
- Audio processing metrics
- API response details

## 📚 API Reference

### VoiceMode Component Props
```tsx
interface VoiceModeProps {
  isOpen: boolean;              // Modal visibility
  onClose: () => void;          // Close callback
  selectedModelId?: string;     // AI model identifier
  selectedProviderId?: string;  // AI provider identifier
}
```

### VoiceFAB Component Props
```tsx
interface VoiceFABProps {
  variant?: 'floating' | 'inline' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  selectedModelId?: string;
  selectedProviderId?: string;
  showLabel?: boolean;
}
```

## 🔮 Future Enhancements

- **Multi-language Support**: Support for different languages
- **Voice Selection**: Choose from different AI voices
- **Audio Recording**: Save conversation recordings
- **Voice Commands**: Shortcuts for common EOS actions
- **Integration**: Connect with calendar and document systems

## 📞 Support

For issues with voice mode:
1. Check this troubleshooting guide
2. Verify browser and system requirements
3. Test with a different browser or device
4. Contact support with browser console logs

---

*Voice Mode leverages cutting-edge AI technology to make EOS implementation more accessible and interactive. Speak naturally about your business challenges and get immediate, conversational guidance from your EOS AI assistant.* 