# React Error #310 Solutions

## Issue
"Rendered more hooks than during the previous render" in production builds.

## Root Cause
- Route Groups with different layouts
- Server-side redirects between route groups
- Provider hooks executing in different orders during navigation

## Primary Solution ✅ (Implemented)
Replaced server `redirect()` with client-side routing using `useRouter().replace()`.

## Alternative Solutions

### Option 1: Middleware Redirect
Move authentication logic to middleware:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  if (isLoggedIn && nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/chat', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Option 2: Conditional Layout Rendering
Instead of redirects, conditionally render layouts:

```typescript
// app/page.tsx
export default async function Home() {
  const session = await auth();

  if (session) {
    // Render chat layout directly
    return <ChatLayoutWrapper />;
  }

  return <HomeClient />;
}
```

### Option 3: Single Layout Structure
Consolidate route groups into a single layout if possible.

## Prevention Tips

1. **Avoid server redirects between route groups**
2. **Use middleware for authentication redirects**
3. **Minimize conditional hook usage in providers**
4. **Use React.memo for expensive provider components**
5. **Implement proper loading states during navigation**

## Debugging

Check for:
- Conditional hook calls in components
- Different provider hierarchies between routes
- Async operations affecting hook execution order

## Monitoring

Add error tracking to catch similar issues:

```typescript
useEffect(() => {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes?.('more hooks')) {
      // Report to error service
      reportError(new Error(args.join(' ')));
    }
    originalError(...args);
  };
}, []);
``` 