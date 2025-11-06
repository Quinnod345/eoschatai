# Authentication & Session Management Fixes

## Issues Identified

Your authentication system had several critical issues that were causing unexpected logouts and redirects:

### 1. **Missing Session Configuration**
- No explicit session strategy defined (defaulting to inconsistent behavior)
- No `maxAge` setting (session lifetime unclear)
- No `updateAge` setting (sessions not refreshing properly)
- No cookie configuration (cookies might not persist correctly)

### 2. **Middleware Redirect Issues**
- Authenticated users visiting `/` (landing page) were not redirected to `/chat`
- Guest users were being redirected to `/` for ALL routes, not just protected ones
- This created confusion and made it seem like users were logged out

### 3. **Missing Session Refresh Logic**
- No client-side session polling
- No automatic session refresh on window focus
- Sessions could expire without the user being aware

### 4. **Poor Error Handling in JWT Callbacks**
- JWT callback didn't handle the `trigger` parameter
- No proper handling of session updates
- Missing profile picture persistence

## Fixes Applied

### 1. Session Configuration (`app/(auth)/auth.config.ts`)
```typescript
session: {
  strategy: 'jwt' as const,
  maxAge: 30 * 24 * 60 * 60, // 30 days
  updateAge: 24 * 60 * 60, // Update session every 24 hours
},
cookies: {
  sessionToken: {
    name: `next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    },
  },
},
```

**Impact:** Sessions now have a clear 30-day lifetime and refresh every 24 hours to stay active.

### 2. Improved Middleware Logic (`middleware.ts`)
```typescript
// Redirect authenticated users from landing page to chat
if (token && !isGuest && pathname === '/') {
  return NextResponse.redirect(new URL('/chat', request.url));
}

// Only redirect guests from protected routes, not all routes
if (token && isGuest) {
  if (
    pathname.startsWith('/chat') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/academy')
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
```

**Impact:** 
- Logged-in users are automatically sent to `/chat` when visiting the landing page
- Guest users can browse non-protected pages without being constantly redirected

### 3. Enhanced Session Provider (`components/session-provider-wrapper.tsx`)
```typescript
<SessionProvider
  refetchInterval={5 * 60} // Refetch every 5 minutes
  refetchOnWindowFocus={true} // Refetch when window regains focus
  refetchWhenOffline={false}
>
```

**Impact:** Sessions are actively maintained and refreshed, preventing unexpected logouts.

### 4. Improved JWT Callbacks (`app/(auth)/auth.ts`)
```typescript
async jwt({ token, user, account, trigger }) {
  // Handle initial sign-in
  if (user) {
    token.id = user.id as string;
    token.type = user.type;
    token.profilePicture = user.profilePicture;
  }

  // Handle session updates
  if (trigger === 'update' && token.id) {
    return token; // Keep existing data
  }

  return token;
}
```

**Impact:** Profile pictures and other user data persist correctly across session refreshes.

### 5. Session Monitoring (`components/session-monitor.tsx`)
A new component that:
- Monitors session state changes
- Detects unexpected logouts
- Logs session issues for debugging
- Periodically checks session health

**Impact:** You'll be alerted in the console if sessions are lost unexpectedly.

## New Debugging Tools

### 1. Debug Page: `/debug-auth`
Visit `http://localhost:3000/debug-auth` to see:
- Current session status
- Full session object
- Cookie information
- Auth API check results
- Environment details

### 2. Console Debugging
Open browser console and type:
```javascript
window.debugAuth()
```

This will show:
- All cookies
- Session/local storage keys
- Auth API status
- Timestamp

### 3. Session Monitor Logs
The SessionMonitor component logs to console in development mode:
```
[SessionMonitor] Session status: authenticated
[SessionMonitor] User: { id: '...', email: '...', type: 'regular' }
```

## Testing the Fixes

### 1. Test Login Persistence
1. Sign in to your account
2. Navigate to `/chat`
3. Visit the landing page `/` - you should be redirected back to `/chat`
4. Refresh the page - you should stay logged in
5. Open a new tab and visit the site - you should still be logged in

### 2. Test Session Refresh
1. Sign in and note the time
2. Keep the browser tab open for 5+ minutes
3. The session should automatically refresh (check Network tab for `/api/auth/session` calls)
4. You should remain logged in

### 3. Test Window Focus Refresh
1. Sign in and open the app
2. Switch to another window/tab for a few minutes
3. Return to the app - session should refresh automatically
4. Check console for SessionMonitor logs

### 4. Debug Auth Issues
1. Visit `/debug-auth`
2. Check if session status is "authenticated"
3. Verify user ID and email are present
4. Check cookies in the debug info
5. Look for any errors in the console

## Common Issues & Solutions

### Issue: Still getting logged out randomly
**Check:**
1. Visit `/debug-auth` and check if cookies are present
2. Open DevTools > Application > Cookies and look for `next-auth.session-token`
3. Check console for `[SessionMonitor]` warnings
4. Verify `AUTH_SECRET` environment variable is set

**Solution:**
- Clear all cookies and sign in again
- Check if browser is blocking cookies
- Ensure `AUTH_SECRET` is consistent across deployments

### Issue: Redirected to landing page when logged in
**Check:**
1. Open console and look for redirect logs
2. Visit `/debug-auth` to verify session status
3. Check if you're being treated as a guest user

**Solution:**
- The middleware fix should resolve this
- If persists, check if your email matches `guestRegex` pattern in `lib/constants.ts`

### Issue: Session expires too quickly
**Check:**
1. Session `maxAge` is set to 30 days
2. Session `updateAge` is set to 24 hours
3. Check if cookies are being deleted by browser

**Solution:**
- Adjust `maxAge` in `auth.config.ts` if needed
- Ensure cookies are not being cleared by extensions/settings

## Environment Variables

Ensure these are set in your `.env.local`:

```bash
AUTH_SECRET=your-secret-key-here  # Must be set!
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NODE_ENV=development  # or production
```

**Important:** The `AUTH_SECRET` must be:
- At least 32 characters
- Consistent across all environments
- Never committed to git

Generate a new one:
```bash
openssl rand -base64 32
```

## Production Checklist

Before deploying:

- [ ] `AUTH_SECRET` is set in production environment
- [ ] Cookies are set to `secure: true` in production (automatic)
- [ ] Session monitoring is disabled or logs are suppressed in production
- [ ] `/debug-auth` page is removed or protected in production
- [ ] Test login flow on production domain
- [ ] Verify cookies work with your production domain

## Architecture Overview

```
User Login
    ↓
Next-Auth Credentials/Google Provider
    ↓
JWT Callback (creates token with user data)
    ↓
Session Token Cookie (httpOnly, secure in prod)
    ↓
Session Callback (creates session from token)
    ↓
SessionProviderWrapper (client-side session management)
    ↓
SessionMonitor (monitors for issues)
    ↓
Middleware (checks token on each request)
    ↓
Protected Routes (accessible if authenticated)
```

## Next Steps

1. **Test thoroughly**: Use the debug tools to verify sessions are working
2. **Monitor logs**: Watch for SessionMonitor warnings in console
3. **Clear old sessions**: Have users clear cookies and log in again
4. **Production deploy**: Deploy the fixes and monitor for issues

## Support

If you continue to experience session issues:

1. Visit `/debug-auth` and capture the output
2. Check browser console for errors
3. Look at Network tab for failed `/api/auth/session` requests
4. Check server logs for JWT/Session callback errors
5. Verify environment variables are set correctly

The SessionMonitor component will help catch issues early and provide debugging information.

