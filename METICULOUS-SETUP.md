# Meticulous Recording Setup

This document explains how Meticulous has been integrated into the EOS Chat AI application to enable full application recording, including authenticated areas.

## Overview

Meticulous is a testing tool that records user sessions to automatically maintain test coverage. We've configured it to work seamlessly with the application's authentication system.

## What Was Implemented

### 1. Meticulous Script Integration
- Added the Meticulous recording script to `/app/layout.tsx`
- Script only loads in development (`NODE_ENV=development`) or preview (`VERCEL_ENV=preview`) environments
- Recording token: `ExoKs5MrAz4fUbTBIqlp9eONnNMv0xV7MbUqgfi3`

### 2. Authentication Bypass for Meticulous
- Modified middleware (`/middleware.ts`) to detect and allow Meticulous sessions
- Added mock data response in `/api/me` for Meticulous sessions
- Created auth wrapper (`/lib/auth/meticulous.ts`) for mock session injection

### 3. Detection Methods
Meticulous sessions are detected using any of these methods:
- Query parameter: `?meticulous=true`
- HTTP header: `x-meticulous-session: true`
- Cookie: `meticulous-session=true` (automatically set after first access)

## How to Use

### Option 1: URL Parameter (Recommended)
To start a Meticulous recording session, simply add `?meticulous=true` to any URL:

```
https://your-app.vercel.app/?meticulous=true
https://your-app.vercel.app/chat?meticulous=true
```

Once you access the app with this parameter, a session cookie is set that persists for 24 hours, allowing navigation without repeatedly adding the parameter.

### Option 2: Browser Extension / Script
If Meticulous provides a browser extension or script that sets custom headers, it will automatically be detected via the `x-meticulous-session` header.

## Mock User Details

When Meticulous is recording, the following mock user is injected:

```json
{
  "user": {
    "id": "meticulous-test-user",
    "email": "test@meticulous.ai",
    "name": "Meticulous Test User",
    "plan": "premium",
    "orgId": "meticulous-test-org"
  },
  "org": {
    "id": "meticulous-test-org",
    "name": "Meticulous Test Organization",
    "plan": "premium"
  }
}
```

All features are enabled for the test user to ensure comprehensive recording coverage.

## Security Considerations

1. **Environment Protection**: The bypass ONLY works in development and preview environments. It's completely disabled in production.

2. **No Real Data Access**: The mock session doesn't grant access to real user data - it uses completely synthetic test data.

3. **Explicit Activation**: The bypass requires explicit activation via query parameter, header, or cookie.

## Troubleshooting

### Recording Still Only Shows Login Page
1. Ensure you're accessing the app with `?meticulous=true` parameter
2. Check browser developer tools for the `meticulous-session` cookie
3. Verify you're in development or preview environment

### Session Not Persisting
- The session cookie lasts 24 hours
- Clear cookies and re-access with `?meticulous=true` to refresh

### Features Not Working
- All features should be enabled for the test user
- Check browser console for any errors
- Ensure the Meticulous script is loading (check Network tab)

## Testing the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Access the app with Meticulous enabled:
   ```
   http://localhost:3000/?meticulous=true
   ```

3. Navigate through the app - you should have full access without needing to log in

4. Check that Meticulous is recording by looking for network requests to `meticulous.ai`

## Future Enhancements

If needed, we can extend this setup to:
- Support multiple test user personas
- Add specific test data for different scenarios
- Include test-specific UI indicators
- Add more granular feature flag controls

## Reverting Changes

If you need to remove Meticulous integration:
1. Remove the script tag from `/app/layout.tsx`
2. Remove the Meticulous detection logic from `/middleware.ts`
3. Remove the mock data logic from `/api/me/route.ts`
4. Delete `/lib/auth/meticulous.ts`
5. Delete this documentation file
