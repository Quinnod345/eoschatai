import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const OAUTH_STATE_VERSION = 'v1';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const RETURN_TO_BASE_ORIGIN = 'http://localhost';

type CalendarOAuthStatePayload = {
  uid: string;
  nonce: string;
  iat: number;
  returnTo?: string;
};

function getOAuthStateSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;

  if (!secret) {
    throw new Error('Missing secret for calendar OAuth state signing');
  }

  return secret;
}

function safeCompare(signature: string, expected: string): boolean {
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function sanitizeCalendarReturnTo(
  returnTo: string | null | undefined,
): string | undefined {
  if (!returnTo) {
    return undefined;
  }

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return undefined;
  }

  if (returnTo.includes('\n') || returnTo.includes('\r')) {
    return undefined;
  }

  try {
    const parsed = new URL(returnTo, RETURN_TO_BASE_ORIGIN);
    if (parsed.origin !== RETURN_TO_BASE_ORIGIN) {
      return undefined;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

export function createCalendarOAuthState(
  userId: string,
  returnTo?: string | null,
): string {
  const payload: CalendarOAuthStatePayload = {
    uid: userId,
    nonce: randomUUID(),
    iat: Date.now(),
  };

  const sanitizedReturnTo = sanitizeCalendarReturnTo(returnTo);
  if (sanitizedReturnTo) {
    payload.returnTo = sanitizedReturnTo;
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const stateBody = `${OAUTH_STATE_VERSION}.${encodedPayload}`;
  const signature = createHmac('sha256', getOAuthStateSecret())
    .update(stateBody)
    .digest('base64url');

  return `${stateBody}.${signature}`;
}

export function verifyCalendarOAuthState(
  state: string | null,
  expectedUserId: string,
): { valid: boolean; returnTo?: string } {
  if (!state) {
    return { valid: false };
  }

  const [version, encodedPayload, signature] = state.split('.');
  if (!version || !encodedPayload || !signature) {
    return { valid: false };
  }

  if (version !== OAUTH_STATE_VERSION) {
    return { valid: false };
  }

  const stateBody = `${version}.${encodedPayload}`;
  let expectedSignature: string;
  try {
    expectedSignature = createHmac('sha256', getOAuthStateSecret())
      .update(stateBody)
      .digest('base64url');
  } catch {
    return { valid: false };
  }

  if (!safeCompare(signature, expectedSignature)) {
    return { valid: false };
  }

  let payload: CalendarOAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as CalendarOAuthStatePayload;
  } catch {
    return { valid: false };
  }

  if (payload.uid !== expectedUserId) {
    return { valid: false };
  }

  if (
    typeof payload.iat !== 'number' ||
    Date.now() - payload.iat > OAUTH_STATE_TTL_MS ||
    payload.iat > Date.now() + 60_000
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    returnTo: sanitizeCalendarReturnTo(payload.returnTo),
  };
}
