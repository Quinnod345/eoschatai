# Redis Setup Guide for EOS Chat AI

This guide explains how to set up Redis for resumable streams in EOS Chat AI, which will improve the reliability of chat sessions by enabling reconnection to ongoing conversations even after a temporary connection loss.

## Why Redis for Resumable Streams?

Resumable streams provide several benefits:

1. **Connection Resilience**: If a user's connection drops temporarily, they won't lose their ongoing AI response
2. **Better User Experience**: No need to restart conversations after connection issues
3. **State Preservation**: Maintains chat state between page refreshes or when switching devices
4. **Load Balancing Support**: Maintains conversation continuity even if requests route to different server instances

## Setting Up Redis

### Option 1: Upstash Redis (Recommended for Production)

1. Go to [Upstash](https://upstash.com/) and create an account
2. Create a new Redis database
   - Choose the region closest to your Vercel deployment
   - Select the appropriate plan (free tier works for development)
3. Once created, go to the "Connect" tab and copy the Redis connection string
4. Add the connection string to your `.env.local` file and Vercel environment variables:
   ```
   REDIS_URL=redis://default:your_password@your_endpoint:your_port
   ```

### Option 2: Redis Labs

1. Go to [Redis Labs](https://redis.com/) and create an account
2. Create a new Redis database
3. Copy the connection string and add it to your `.env.local` file and Vercel environment variables

### Option 3: Local Redis (Development Only)

1. Install Redis on your machine:
   - Mac: `brew install redis` and then `brew services start redis`
   - Windows: Download and install from [Redis for Windows](https://github.com/tporadowski/redis/releases)
   - Linux: `sudo apt-get install redis-server`
2. Add the connection string to your `.env.local` file:
   ```
   REDIS_URL=redis://localhost:6379
   ```

## Testing Your Redis Connection

1. Make sure you've added the REDIS_URL to your `.env.local` file
2. Run the test script:
   ```
   node scripts/test-redis-connection.js
   ```
3. If successful, you should see "Redis test completed successfully!"

## Vercel Integration

1. Go to your Vercel project
2. Navigate to "Settings" > "Environment Variables"
3. Add the REDIS_URL environment variable with your Redis connection string
4. Deploy your application

## Troubleshooting

### Connection Issues

If you see errors like:
- "REDIS_URL is not defined in .env.local"
  - Make sure you've added the REDIS_URL to your .env.local file
- "Redis connection error: Connection refused"
  - Check that your Redis server is running and accessible from your machine
  - For local Redis, ensure the Redis service is running
  - For Upstash/Redis Labs, check your IP allowlist settings

### Vercel Environment Variables

- If resumable streams work locally but not in production, verify the REDIS_URL is correctly set in your Vercel environment variables
- You may need to redeploy your application after updating environment variables

## Redis Security Best Practices

1. Use strong passwords for your Redis instance
2. For production, set appropriate IP allowlist rules
3. Regularly rotate Redis credentials
4. Monitor Redis usage to prevent excessive consumption 