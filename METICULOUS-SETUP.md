# Meticulous Recording Setup

This document explains how Meticulous has been integrated into the EOSAI application to enable full application recording without authentication barriers.

## Overview

Meticulous is a frontend testing tool that records user sessions to automatically maintain test coverage. Since Meticulous automatically stubs all network responses, we only need to prevent authentication redirects - not provide mock data.

## What Was Implemented

### 1. Meticulous Script Integration
- Added the Meticulous recording script to `/app/layout.tsx`
- Script only loads in development (`NODE_ENV=development`) or preview (`VERCEL_ENV=preview`) environments
- Recording token: `ExoKs5MrAz4fUbTBIqlp9eONnNMv0xV7MbUqgfi3`

### 2. Authentication Redirect Bypass
- Modified middleware (`/middleware.ts`) to skip auth checks for Meticulous sessions
- No mock data needed - Meticulous handles response stubbing automatically

### 3. Detection Method
Meticulous sessions are detected using a custom header:
- HTTP header: `x-meticulous-recording` 
- Value: Set to your secret value (or `'true'` if no secret configured)

## How to Use

### Step 1: Configure Meticulous Project Settings

In your Meticulous project settings:
1. Go to the **Custom Request Headers** tab
2. Add a new header:
   - Name: `x-meticulous-recording`
   - Value: `true` (or a secret value if you prefer)

### Step 2: (Optional) Set Environment Variable for Secret

If using a secret value for added security:
```bash
# In your .env file or deployment settings
METICULOUS_AUTH_BYPASS_SECRET=your-secret-value
```

### Step 3: Start Recording

Meticulous will now be able to access all authenticated areas of your app without being redirected to login pages. The middleware will detect the custom header and bypass authentication checks.

## How It Works

1. **Meticulous sends the custom header** with every request during recording
2. **Middleware detects the header** and skips authentication checks
3. **Meticulous stubs all API responses** automatically - no real backend calls are made
4. **Full app recording** without authentication barriers

## Security Considerations

1. **Environment Protection**: The bypass ONLY works in development and preview environments. It's completely disabled in production.

2. **Header-Based Security**: Use a secret value in the header for additional security, especially on public preview URLs.

3. **No Backend Access**: Meticulous only tests frontend - all API calls are stubbed, so no real data is accessed.

## Troubleshooting

### Recording Still Shows Login Page
1. Verify the custom header is configured in Meticulous project settings
2. Check that the header name is exactly `x-meticulous-recording`
3. Ensure you're in development or preview environment
4. Check browser dev tools Network tab to see if the header is being sent

### Authentication Errors in Console
- These are normal - Meticulous stubs the responses, so auth errors don't affect the recording
- The important thing is that you're not redirected to login

## Testing the Integration

1. Configure the custom header in Meticulous settings
2. Start your development server:
   ```bash
   npm run dev
   ```
3. Start a Meticulous recording session
4. Navigate through the app - you should have full access without login redirects
5. Check Network tab - you'll see the `x-meticulous-recording` header on requests

## How Meticulous Works

- **Frontend Only**: Meticulous records DOM changes and user interactions
- **Network Stubbing**: All API responses are automatically mocked
- **No Backend Needed**: Your backend doesn't need to be running
- **Deterministic Playback**: Tests are reliable because responses are stubbed

## Reverting Changes

If you need to remove Meticulous integration:
1. Remove the script tag from `/app/layout.tsx`
2. Remove the Meticulous detection logic from `/middleware.ts` (lines 16-31)
3. Delete this documentation file
