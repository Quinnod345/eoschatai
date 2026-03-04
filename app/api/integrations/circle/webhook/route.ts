/**
 * Canonical Circle webhook processing lives in /api/webhooks/circle.
 * This route is kept as a thin adapter for backward compatibility.
 *
 * NOTE: Next.js route segment config (runtime, dynamic) cannot be re-exported
 * from another route file. They must be declared directly in this file.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export { HEAD, GET, POST } from '@/app/api/webhooks/circle/route';
