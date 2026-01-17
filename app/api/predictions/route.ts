import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { getSuggestions } from '@/lib/redis/autocomplete';
import { getPredictiveSuggestions } from '@/lib/predictive/predictive-service';

const requestSchema = z.object({
  prefix: z.string().min(1).max(512),
  // Optional context for smarter predictions
  context: z.object({
    chatId: z.string().optional(),
    personaId: z.string().optional(),
    personaName: z.string().optional(),
    composerDocumentId: z.string().optional(),
    composerKind: z.string().optional(),
    isNewChat: z.boolean().optional(),
    selectedModelId: z.string().optional(),
  }).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const prefix = parsed.data.prefix.trim();
  const context = parsed.data.context;
  
  // Don't suggest for very short prefixes
  if (prefix.length < 3) {
    return NextResponse.json({ predictions: [] });
  }
  
  // Don't suggest if prefix ends with certain characters (punctuation that suggests completion)
  if (/[.!?;:]$/.test(prefix)) {
    return NextResponse.json({ predictions: [] });
  }
  
  // Don't suggest if prefix has multiple lines (likely pasting)
  if (prefix.includes('\n')) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    // Check user settings toggle
    const settingsRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/user-settings`,
      { 
        cache: 'no-store',
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      },
    );
    const settings = settingsRes.ok ? await settingsRes.json() : {};
    if (settings?.autocompleteEnabled === false) {
      return NextResponse.json({ predictions: [] });
    }

    // First, check Redis for cached suggestions (fast)
    const redisResults = await getSuggestions(prefix, { max: 3, fuzzy: true });
    const prefixLower = prefix.toLowerCase();
    
    // Convert Redis results to continuations (remainder only)
    const redisPredictions = (redisResults || [])
      .filter(
        (s) => typeof s === 'string' && s.toLowerCase().startsWith(prefixLower),
      )
      .map((s) => s.slice(prefix.length))
      .map((s) => s.replace(/^\s+/, ''))
      .filter((s) => s.length > 0 && s.length < 50)
      .slice(0, 3);

    // If we have enough Redis predictions, use them (fastest path)
    if (redisPredictions.length >= 3) {
      return NextResponse.json({ 
        predictions: redisPredictions,
        source: 'redis',
      });
    }

    // Use the new predictive service for smarter suggestions
    const result = await getPredictiveSuggestions({
      prefix,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      context: context ? {
        chatId: context.chatId,
        personaId: context.personaId,
        personaName: context.personaName,
        composerDocumentId: context.composerDocumentId,
        composerKind: context.composerKind,
        isNewChat: context.isNewChat,
        selectedModelId: context.selectedModelId,
      } : undefined,
    });

    // Combine Redis and service predictions, dedupe
    const combined = [...new Set([...redisPredictions, ...result.predictions])]
      .slice(0, 3);

    return NextResponse.json({ 
      predictions: combined,
      source: result.metadata.source,
      intent: result.metadata.intent?.type,
    });
  } catch (error) {
    console.error('Predictions API error:', error);
    return NextResponse.json({ predictions: [] });
  }
}
