# Voice Mode Relay Server Implementation

Since OpenAI's Realtime API WebSocket endpoint cannot be accessed directly from browsers, you need a relay server. Here's how to implement it:

## Option 1: Quick Solution - Use OpenAI's Example

```bash
# In a separate terminal/directory
git clone https://github.com/openai/openai-realtime-console
cd openai-realtime-console
npm install

# Add your API key to .env file
echo "OPENAI_API_KEY=your-api-key-here" > .env

# Start the relay server
npm start
```

This will start a relay server on `http://localhost:8080` that you can connect to from your browser.

## Option 2: Custom Relay Server (Node.js)

Create a new file `voice-relay-server.js`:

```javascript
const WebSocket = require('ws');
const http = require('http');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs) => {
  console.log('Client connected');
  
  // Connect to OpenAI
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime', {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI');
    clientWs.send(JSON.stringify({ type: 'relay.connected' }));
  });

  openaiWs.on('message', (data) => {
    clientWs.send(data);
  });

  openaiWs.on('error', (error) => {
    console.error('OpenAI error:', error);
    clientWs.send(JSON.stringify({ type: 'relay.error', error: error.message }));
  });

  openaiWs.on('close', () => {
    console.log('OpenAI disconnected');
    clientWs.close();
  });

  // Forward client messages to OpenAI
  clientWs.on('message', (data) => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(data);
    }
  });

  clientWs.on('close', () => {
    console.log('Client disconnected');
    openaiWs.close();
  });
});

server.listen(PORT, () => {
  console.log(`Relay server running on http://localhost:${PORT}`);
});
```

Run it:
```bash
npm install ws
OPENAI_API_KEY=your-key node voice-relay-server.js
```

## Option 3: Update Your Voice Mode Component

Update `voice-mode.tsx` to connect to your relay server:

```typescript
// Instead of connecting to OpenAI directly:
// const ws = new WebSocket('wss://api.openai.com/v1/realtime', ...);

// Connect to your relay server:
const ws = new WebSocket('ws://localhost:8080');
```

## Production Deployment

For production, you'll need to:

1. **Deploy the relay server** to a service like:
   - Heroku
   - Railway
   - Render
   - Your own VPS

2. **Use secure WebSocket (wss://)** with SSL certificates

3. **Add authentication** to prevent unauthorized access

4. **Handle scaling** if you have many concurrent users

## Alternative: Vercel Edge Functions

If you're already using Vercel, you could potentially use Edge Functions with experimental WebSocket support, though this is still in beta.

## Why This Works

1. **Server-side WebSocket connections** can include Authorization headers
2. **The relay server** acts as a bridge between your browser and OpenAI
3. **No CORS issues** since you control the relay server
4. **Maintains security** by keeping the API key server-side

This is the approach used by OpenAI's official Realtime Console and is the recommended solution for browser-based applications.