# EOSAI UI Bug Review

**Date:** February 4, 2026  
**Tested URL:** https://eosbot.ai  
**Testing Method:** Automated headless browser testing (agent-browser CLI)  
**Viewport:** 1920x1080 (Desktop), iPhone 14 (Mobile)

---

## Summary

Overall, the EOSAI application is in good shape. Form validation works correctly, error handling is functional, and mobile responsiveness is solid. The main issues found are **console errors related to React Three Fiber (R3F) and Sentry integration** that appear on pages with 3D/WebGL elements.

### Issues by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 High | 0 | None |
| 🟠 Medium | 2 | Console errors, 401 errors on load |
| 🟡 Low | 3 | UX improvements, potential confusion |
| ⚪ Info | 2 | Working as expected items |

---

## 🟠 Medium Priority Issues

### 1. React Three Fiber (R3F) / Sentry Console Errors

**Pages Affected:** Landing page (/), Features (/features), Solutions (/solutions)

**Error Messages:**
```
R3F: Cannot set "data-sentry-source-file". Ensure it is an object before setting "sentry-source-file".
Cannot convert undefined or null to object
```

**Occurrence:** Multiple times per page load (3-4 instances each)

**Analysis:** These errors are related to the integration between React Three Fiber (used for 3D graphics/animations) and Sentry error tracking. The Sentry instrumentation is trying to attach source file metadata to R3F components, but the target is not a valid object.

**Recommended Fix:**
1. Check Sentry configuration for R3F compatibility
2. Consider excluding R3F components from Sentry instrumentation
3. Update `@sentry/nextjs` or related packages to latest versions
4. Review `instrumentation.ts` and `instrumentation-client.ts` for R3F-specific handling

---

### 2. 401 Unauthorized Errors on Page Load

**Pages Affected:** Landing page (/)

**Error Messages:**
```
Failed to load resource: the server responded with a status of 401 ()
```

**Occurrence:** 2 requests on initial load

**Analysis:** The application appears to be making API calls that expect authentication even on the public landing page. This doesn't affect functionality but indicates unnecessary network requests.

**Recommended Fix:**
1. Review API calls made on the landing page
2. Ensure authenticated endpoints are only called when user is logged in
3. Check for session checks that may be triggering 401s

---

## 🟡 Low Priority Issues

### 3. Invite Accept Page UX Confusion

**URL:** /invite/accept (without valid token)

**Observation:** When visiting the invite accept page without proper parameters, a toast notification shows "Accepting organization invitation... Please wait while we add you to the organization" while simultaneously displaying the login page.

**Impact:** Could confuse users who land on this page without a valid invite link.

**Recommended Fix:**
1. Check for valid invite token before showing acceptance toast
2. Show error message for missing/invalid invite tokens
3. Redirect to appropriate error page if no token present

---

### 4. WebGL Performance Warnings

**Pages Affected:** Landing page (/)

**Warning:**
```
[.WebGL-0x10c001ae000]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
```

**Impact:** May affect performance on lower-end devices. Shows 4 times then stops repeating.

**Analysis:** The 3D background animation is causing GPU stalls. This is a performance concern but unlikely to cause visible issues on modern hardware.

**Recommended Fix:**
1. Consider reducing animation complexity
2. Add performance detection to disable 3D effects on slower devices
3. Low priority - this is common with WebGL content

---

### 5. Missing/Protected Routes Return Generic 404

**Routes Returning 404:**
- /settings
- /dashboard
- /documents (when not authenticated)
- /admin
- /debug

**Observation:** These routes show a basic "404: This page could not be found" message rather than redirecting to login or showing a more helpful message.

**Analysis:** For protected routes, redirecting to login with a callback URL would be better UX than showing 404.

**Recommended Fix:**
1. For protected routes, redirect to login with callback URL
2. For truly non-existent routes, keep 404
3. Differentiate between "you need to log in" and "this doesn't exist"

---

## ⚪ Working Well (No Issues Found)

### Form Validation ✅
- **Login Page:** Invalid credentials show "Invalid credentials!" toast
- **Registration Page:** 
  - Email validation works
  - Password requirements displayed (8+ chars, uppercase, lowercase, number, special char)
  - Password strength indicator works
  - Password mismatch detection works
  - Terms agreement required
- **Forgot Password:** Form functions correctly

### Mobile Responsiveness ✅
- Hamburger menu appears on mobile viewport
- Menu opens/closes correctly with proper navigation items
- All touch targets appear accessible
- Layout adapts properly to iPhone 14 viewport

### Dark/Light Mode ✅
- Login and registration pages properly support both color schemes
- Landing page uses dark theme (appears intentional for design)
- Form elements have proper contrast in both modes

### Error Page Handling ✅
- Auth error page (/error?error=OAuthAccountNotLinked) shows appropriate message
- "This email is already associated with another account" displayed correctly
- "Try Again" and "Back to Login" buttons work

---

## Pages Tested

| Page | Status | Notes |
|------|--------|-------|
| Landing (/) | ⚠️ | R3F/Sentry errors, 401s |
| Login (/login) | ✅ | Works correctly |
| Register (/register) | ✅ | Works correctly |
| Forgot Password (/forgot-password) | ✅ | Works correctly |
| Features (/features) | ⚠️ | R3F/Sentry errors |
| Solutions (/solutions) | ⚠️ | R3F/Sentry errors |
| Privacy Policy (/privacy) | ✅ | No errors |
| Terms of Service (/terms) | ✅ | No errors |
| Error Page (/error) | ✅ | Handles auth errors well |
| Chat (/chat) | 🔒 | Redirects to login (expected) |
| Account (/account) | 🔒 | Redirects to login (expected) |
| Academy (/academy) | 🔒 | Redirects to login (expected) |

---

## Testing Limitations

1. **Authentication:** Unable to test authenticated pages (chat, settings, documents, etc.) without valid session
2. **OAuth Flow:** Cannot test Google Sign-In in headless browser
3. **Real-time Features:** WebSocket connections and streaming chat not tested
4. **File Uploads:** Document upload functionality not tested

---

## Recommendations Summary

1. **Immediate:** Fix R3F/Sentry integration to eliminate console errors
2. **Short-term:** Review 401 errors on landing page load
3. **Improvement:** Better handling of invite URLs without valid tokens
4. **Nice-to-have:** Differentiate 404 vs "login required" for protected routes

---

*Generated by automated UI testing on Feb 4, 2026*
