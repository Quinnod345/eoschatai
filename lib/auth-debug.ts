/**
 * Auth debugging utilities to help diagnose session issues
 */

export async function debugAuthState() {
  if (typeof window === 'undefined') {
    return null;
  }

  const debug = {
    timestamp: new Date().toISOString(),
    cookies: document.cookie,
    sessionStorage: {
      length: sessionStorage.length,
      keys: [] as string[],
    },
    localStorage: {
      length: localStorage.length,
      keys: [] as string[],
    },
    authApiCheck: null as any,
  };

  // Get session storage keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) {
      debug.sessionStorage.keys.push(key);
    }
  }

  // Get local storage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      debug.localStorage.keys.push(key);
    }
  }

  // Check auth API
  try {
    const response = await fetch('/api/test-auth', {
      credentials: 'include',
    });
    debug.authApiCheck = await response.json();
  } catch (error) {
    debug.authApiCheck = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return debug;
}

export function logAuthDebug() {
  debugAuthState().then((debug) => {
    console.group('🔐 Auth Debug Info');
    console.log('Timestamp:', debug?.timestamp);
    console.log('Cookies:', debug?.cookies);
    console.log('SessionStorage:', debug?.sessionStorage);
    console.log('LocalStorage:', debug?.localStorage);
    console.log('Auth API Check:', debug?.authApiCheck);
    console.groupEnd();
  });
}

// Expose to window for easy debugging
if (typeof window !== 'undefined') {
  (window as any).debugAuth = logAuthDebug;
}

