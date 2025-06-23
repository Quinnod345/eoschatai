# Voice Mode WebSocket Debug Guide

## Current Issue
WebSocket connection fails immediately with error code 1006 (abnormal closure) despite having valid ephemeral tokens.

## Debug Steps

### 1. Check Browser Console
Look for these log messages in order:
- "Creating ephemeral voice session..."
- "Ephemeral session created: [session details]"
- "Client secret type: string"
- "Client secret value: ek_..."
- "Attempting WebSocket connection with ephemeral key"
- "WebSocket created, waiting for connection..."

### 2. Server Logs
The server successfully creates sessions with ephemeral tokens like:
```
Session ID: sess_AUaDPUsKhrGWNfaN2p8Mo
Client secret value: ek_684e75e50c2c8190b4dbcc45d173080c
```

### 3. WebSocket Connection Attempts Tried

#### Attempt 1: Subprotocol with array
```javascript
new WebSocket(url, ['openai-insecure-api-key.' + token])
```
Result: Error 1006

#### Attempt 2: Query parameters
```javascript
new WebSocket(`${url}?session_id=${id}&session_token=${token}`)
```
Result: Error 1006

#### Attempt 3: Session-specific endpoint with Bearer
```javascript
new WebSocket(`wss://api.openai.com/v1/realtime/sessions/${id}?model=gpt-4o-realtime-preview`, [`Bearer.${token}`])
```
Result: Error 1006

#### Attempt 4: Subprotocol as string
```javascript
new WebSocket(url, `openai-insecure-api-key.${token}`)
```
Result: Error 1006

#### Attempt 5: Session and key subprotocols (current)
```javascript
new WebSocket('wss://api.openai.com/v1/realtime', [`session.${id}`, `key.${token}`])
```
Result: Testing now - This matches the VOICE-MODE-FIXES.md documentation

## Possible Issues

1. **Authentication Format**: The ephemeral token might need a different authentication method than the API key approach.

2. **WebSocket vs WebRTC**: OpenAI documentation suggests WebRTC might be preferred for browser connections with ephemeral tokens.

3. **Token Format**: The token format (ek_...) might require special handling.

4. **Missing Headers**: Browser WebSocket API doesn't support custom headers, which might be required.

## Current Status

We've successfully:
1. Created the `/api/voice/session` endpoint that generates ephemeral tokens
2. Updated the model to `gpt-4o-realtime-preview-2024-12-17`
3. Tried multiple WebSocket connection formats
4. Confirmed ephemeral tokens are NOT valid for regular API calls (401 error)
5. Added development-only direct API key testing

Key Findings:
- Ephemeral tokens return 401 Unauthorized for regular API calls
- This confirms they're specifically for Realtime API connections only
- WebSocket connections still fail with error 1006 using ephemeral tokens
- The issue appears to be that ephemeral tokens might not work with direct WebSocket connections from browsers

## Next Steps

1. **Use Direct API Key (Development Only)**: For testing, try using the API key directly with the `openai-insecure-api-key` subprotocol.

2. **Implement WebRTC**: Since ephemeral tokens are designed for WebRTC, implement the RTCPeerConnection approach (see voice-mode-webrtc.tsx).

3. **Deploy a WebSocket Proxy Server**: Create a separate Node.js server that can handle WebSocket connections with proper headers.

4. **Contact OpenAI Support**: The consistent 1006 errors suggest either:
   - Ephemeral tokens don't work with WebSocket (only WebRTC)
   - There's an undocumented authentication format
   - Browser WebSocket connections are blocked

## Alternative Approaches

1. **Proxy Server**: Create a server-side WebSocket proxy that can add proper headers.

2. **Direct API Key**: For testing only, try using the API key directly (not recommended for production).

3. **WebRTC Implementation**: Switch to the WebRTC approach as suggested in OpenAI docs for browser-based connections.