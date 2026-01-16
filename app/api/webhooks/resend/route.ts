import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { db } from '@/lib/db';
import { orgInvitation } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Resend webhook event types
const ResendEventSchema = z.object({
  type: z.enum([
    'email.sent',
    'email.delivered',
    'email.opened',
    'email.clicked',
    'email.bounced',
    'email.complained',
    'email.delivery_delayed',
  ]),
  created_at: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string().optional(),
    to: z.array(z.string()).optional(),
    subject: z.string().optional(),
    click: z
      .object({
        ipAddress: z.string().optional(),
        link: z.string().optional(),
        timestamp: z.string().optional(),
        userAgent: z.string().optional(),
      })
      .optional(),
    bounce: z
      .object({
        type: z.string().optional(),
      })
      .optional(),
  }),
});

type ResendEvent = z.infer<typeof ResendEventSchema>;

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  // Resend uses svix for webhooks
  const crypto = require('crypto');
  const webhookSecret = secret.split(' ').pop(); // Extract the secret part

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('base64');

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`v1=${expectedSignature}`),
  );
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    // Get raw body and signature
    const payload = await request.text();
    const signature = request.headers.get('svix-signature');

    // For now, we'll skip signature verification in development
    // In production, you should verify the signature
    if (process.env.NODE_ENV === 'production' && webhookSecret !== 'skip') {
      if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 },
        );
      }
    }

    // Parse the event
    const event = ResendEventSchema.parse(JSON.parse(payload));
    console.log(
      '[resend-webhook] Received event:',
      event.type,
      event.data.email_id,
    );

    // Update invitation status based on event type
    const emailId = event.data.email_id;
    const timestamp = new Date(event.created_at);

    switch (event.type) {
      case 'email.delivered': {
        await db
          .update(orgInvitation)
          .set({
            status: 'delivered',
            deliveredAt: timestamp,
            metadata: event.data,
          })
          .where(eq(orgInvitation.resendId, emailId));
        break;
      }

      case 'email.opened': {
        // Only update if not already in a later state
        const [existing] = await db
          .select()
          .from(orgInvitation)
          .where(eq(orgInvitation.resendId, emailId));

        if (existing && !['clicked', 'accepted'].includes(existing.status)) {
          await db
            .update(orgInvitation)
            .set({
              status: 'opened',
              openedAt: timestamp,
              metadata: {
                ...(existing.metadata || {}),
                lastOpened: event.data,
              },
            })
            .where(eq(orgInvitation.resendId, emailId));
        }
        break;
      }

      case 'email.clicked': {
        // Only update if not already accepted
        const [existing] = await db
          .select()
          .from(orgInvitation)
          .where(eq(orgInvitation.resendId, emailId));

        if (existing && existing.status !== 'accepted') {
          await db
            .update(orgInvitation)
            .set({
              status: 'clicked',
              clickedAt: timestamp,
              metadata: { ...(existing.metadata || {}), lastClick: event.data },
            })
            .where(eq(orgInvitation.resendId, emailId));
        }
        break;
      }

      case 'email.bounced': {
        await db
          .update(orgInvitation)
          .set({
            status: 'bounced',
            metadata: { ...event.data, bounceType: event.data.bounce?.type },
          })
          .where(eq(orgInvitation.resendId, emailId));
        break;
      }

      case 'email.complained': {
        // User marked as spam
        await db
          .update(orgInvitation)
          .set({
            status: 'failed',
            metadata: { ...event.data, reason: 'spam_complaint' },
          })
          .where(eq(orgInvitation.resendId, emailId));
        break;
      }

      default:
        console.log('[resend-webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[resend-webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 400 },
    );
  }
}
