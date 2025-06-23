# Voice Mode Testing Guide

## Fixed Issues

1. **WebSocket Subprotocol Error**: Fixed the invalid subprotocol error by properly formatting the ephemeral token in the WebSocket connection.
   - Changed from `key.[object Object]` to `openai-insecure-api-key.${session.client_secret}`

2. **API Endpoint**: Updated to use the correct OpenAI Realtime API endpoint for creating sessions.

3. **Session Configuration**: Moved session configuration to WebSocket onopen event using `session.update` message.

## How to Test

1. **Start the development server** (if not already running):
   ```bash
   pnpm dev
   ```

2. **Open the application** at http://localhost:3000

3. **Click the voice mode button** (microphone floating action button)

4. **Grant microphone permissions** when prompted

5. **Watch the console** for debugging information:
   - Should see: "Creating ephemeral voice session..."
   - Should see: "Ephemeral session created: [session_id]"
   - Should see: "Voice mode: Connected to OpenAI Realtime API"

## Expected Behavior

- The voice mode modal should open
- Connection status should change from "Connecting..." to "Connected"
- The microphone indicator should respond to your voice (visual feedback)
- You should be able to speak and receive audio responses
- Transcripts should appear in the conversation section

## Troubleshooting

If you still encounter issues:

1. **Check browser console** for any error messages
2. **Verify OPENAI_API_KEY** is set in your environment variables
3. **Ensure you're using a supported browser** (Chrome, Edge, Safari latest versions)
4. **Check network tab** for failed API requests

## Technical Details

The implementation now uses:
- Ephemeral tokens for secure browser connections
- WebSocket with proper subprotocol authentication
- Session configuration via WebSocket messages
- Real-time audio streaming with PCM16 format