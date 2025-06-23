# Voice Mode Production Deployment Guide

## Overview
The voice mode uses OpenAI's WebRTC-based Realtime API with ephemeral tokens for secure, serverless deployment. No relay server or WebSocket infrastructure needed!

## Architecture
- **Serverless API Route**: `/app/api/voice/session/route.ts` generates ephemeral tokens
- **Client-Side WebRTC**: Direct browser-to-OpenAI connection
- **No Persistent Connections**: Each session is independent
- **Secure**: API key never exposed to client

## Production Requirements

### 1. Environment Variables
Add to your production environment (Vercel, etc.):
```bash
OPENAI_API_KEY=sk-proj-xxxxx  # Your OpenAI API key with Realtime access
```

### 2. OpenAI Account Requirements
- Access to `gpt-4o-realtime-preview-2024-12-17` model
- Sufficient API credits for voice usage
- Realtime API tier access

### 3. HTTPS Required
WebRTC requires HTTPS in production. Most deployment platforms (Vercel, Netlify, etc.) provide this automatically.

## Deployment Steps

### Vercel (Recommended)
1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variable:
   - `OPENAI_API_KEY` = your OpenAI API key
4. Deploy!

### Other Platforms
Any platform supporting Next.js serverless functions works:
- Netlify
- AWS Amplify
- Railway
- Render

## Cost Considerations

### OpenAI Pricing (as of Dec 2024)
- **Audio Input**: $0.06 per minute
- **Audio Output**: $0.24 per minute
- **Text tokens**: Standard GPT-4 pricing

### Cost Optimization
1. **Session Limits**: Consider implementing time limits
2. **User Authentication**: Restrict to authenticated users
3. **Rate Limiting**: Add rate limits to prevent abuse
4. **Usage Tracking**: Monitor usage per user

## Security Best Practices

### 1. Authentication
The current implementation requires authentication. Keep this enabled:
```typescript
// In /app/api/voice/session/route.ts
const session = await auth();
if (!session?.user?.id) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 2. Rate Limiting
Add rate limiting to prevent abuse:
```typescript
// Example with Upstash Rate Limit
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 sessions per hour
});

// In your route handler
const { success } = await ratelimit.limit(userId);
if (!success) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 3. Session Monitoring
Track active sessions to prevent concurrent abuse:
```typescript
// Store active sessions in Redis or database
const activeSession = await redis.get(`voice:${userId}`);
if (activeSession) {
  return new Response('Session already active', { status: 409 });
}

// Set session with TTL
await redis.set(`voice:${userId}`, sessionId, { ex: 3600 }); // 1 hour TTL
```

## Monitoring & Analytics

### 1. Session Tracking
Log voice sessions for analytics:
```typescript
// Log to your analytics service
await analytics.track({
  userId: session.user.id,
  event: 'voice_session_started',
  properties: {
    duration: 0,
    model: 'gpt-4o-realtime-preview-2024-12-17',
  }
});
```

### 2. Error Monitoring
Use error tracking services:
- Sentry
- LogRocket
- Datadog

### 3. Usage Dashboards
Create dashboards to monitor:
- Active sessions
- Session duration
- Error rates
- Cost per user

## Scaling Considerations

### 1. Ephemeral Token Caching
The current implementation creates a new token for each session. This is secure but consider:
- Token reuse within a short window (5 minutes)
- Pre-warming tokens for premium users

### 2. Geographic Distribution
- Deploy to multiple regions
- Use edge functions for token generation
- Consider OpenAI's regional availability

### 3. Load Balancing
WebRTC connections are P2P, so server load is minimal. Main considerations:
- Token generation endpoint scaling
- Database/Redis connection pooling
- CDN for static assets

## Troubleshooting Production Issues

### Common Issues
1. **"Failed to get session token"**
   - Check OPENAI_API_KEY is set
   - Verify API key has Realtime access
   - Check OpenAI API status

2. **"Connection failed"**
   - Ensure HTTPS is enabled
   - Check browser WebRTC support
   - Verify firewall rules

3. **Audio Quality Issues**
   - Check user's internet bandwidth
   - Monitor packet loss
   - Consider fallback to text mode

### Debug Mode
Add debug logging in production:
```typescript
if (process.env.VOICE_DEBUG === 'true') {
  console.log('Voice session created:', {
    userId: session.user.id,
    timestamp: new Date().toISOString(),
  });
}
```

## Future Enhancements

### 1. Multi-Model Support
```typescript
const model = request.headers.get('X-Voice-Model') || 'gpt-4o-realtime-preview-2024-12-17';
```

### 2. Custom Voices
When OpenAI releases more voices:
```typescript
voice: process.env.VOICE_PREFERENCE || 'alloy'
```

### 3. Conversation History
Store transcripts for later reference:
```typescript
await db.insert(voiceTranscripts).values({
  userId: session.user.id,
  transcript: fullTranscript,
  duration: sessionDuration,
  createdAt: new Date(),
});
```

## Conclusion
The WebRTC implementation is production-ready and scales well. The serverless architecture means no infrastructure to manage - just deploy and go!