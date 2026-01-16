import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { getSuggestions } from '@/lib/redis/autocomplete';
import { createCustomProvider } from '@/lib/ai/providers';
import { generateText } from 'ai';

const requestSchema = z.object({
  prefix: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const prefix = parsed.data.prefix.trim();
  try {
    // Check toggle
    const settingsRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/user-settings`,
      { cache: 'no-store' },
    );
    const settings = settingsRes.ok ? await settingsRes.json() : {};
    if (settings?.autocompleteEnabled === false) {
      return NextResponse.json({ predictions: [] });
    }

    const redisResults = await getSuggestions(prefix, { max: 3, fuzzy: true });
    const prefixLower = prefix.toLowerCase();
    // Use only phrases that continue the prefix and convert to tails (remainder only)
    let predictions = (redisResults || [])
      .filter(
        (s) => typeof s === 'string' && s.toLowerCase().startsWith(prefixLower),
      )
      .map((s) => s.slice(prefix.length))
      .map((s) => s.replace(/^\s+/, ''))
      .slice(0, 3);

    if (predictions.length < 3) {
      const provider = createCustomProvider();
      const systemPrompt = `You are a text completion engine that suggests the NEXT FEW WORDS to complete what the user is typing.

CRITICAL RULES:
1. Output ONLY the continuation text (the next few words), NOT the full answer
2. DO NOT answer the user's question - only suggest how to FINISH TYPING their query
3. Keep completions SHORT: 2-8 words maximum
4. Output plain text continuations only, one per line, no numbering, no quotes
5. DO NOT output full sentences that answer questions
6. DO NOT output question marks unless the user is clearly typing a question
7. DO NOT generate explanations, answers, or responses - ONLY text continuations

Examples:
User typing: "How do I run"
GOOD: "a Level 10 meeting", "an effective IDS session", "my quarterly planning"
BAD: "You should start by scheduling it", "Here's how to run meetings", "?"

User typing: "What are the best"
GOOD: "practices for Rocks", "ways to set Rocks", "accountability measures"
BAD: "The best practices are...", "You should focus on...", "?"

User typing: "Help me with"
GOOD: "my V/TO", "setting up Rocks", "accountability chart"
BAD: "I can help you with that", "What do you need help with?", "?"

Focus on EOS business topics: Rocks, L10 meetings, IDS, V/TO, accountability charts, scorecards, vision, leadership, etc.`;

      const promptStr = `User is typing: "${prefix}"\n\nSuggest 3 SHORT continuations (2-8 words each) to complete their typing. Output ONLY the continuation text, one per line:`;

      const { text } = await generateText({
        model: provider.languageModel('gpt-4.1-nano'),
        temperature: 0.3,
        maxOutputTokens: 60,
        system: systemPrompt,
        prompt: promptStr,
      });

      const nano = text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => {
          // Filter out bad completions
          const lower = s.toLowerCase();

          // Skip if it looks like an answer or explanation
          if (
            lower.startsWith('you should') ||
            lower.startsWith('you can') ||
            lower.startsWith('try to') ||
            lower.startsWith('i can') ||
            lower.startsWith('here') ||
            lower.startsWith('the best') ||
            lower.includes('...')
          ) {
            return false;
          }

          // Skip if it ends with '?' AND looks like a full answer (starts with common question words)
          // This preserves partial query completions like "a quarterly review?" while filtering "What do you need help with?"
          if (
            s.endsWith('?') &&
            (lower.startsWith('what ') ||
              lower.startsWith('how ') ||
              lower.startsWith('why ') ||
              lower.startsWith('when ') ||
              lower.startsWith('where ') ||
              lower.startsWith('who ') ||
              lower.startsWith('which ') ||
              lower.startsWith('do you ') ||
              lower.startsWith('can you ') ||
              lower.startsWith('would you '))
          ) {
            return false;
          }

          // Skip if too long (likely a full answer)
          if (s.split(' ').length > 10) {
            return false;
          }

          // Skip if it's just repeating the prefix
          if (s.toLowerCase() === prefix.toLowerCase()) {
            return false;
          }

          return true;
        })
        .slice(0, 3);

      predictions = [...new Set([...predictions, ...nano])].slice(0, 3);
    }

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error('Predictions API error', error);
    return NextResponse.json({ predictions: [] });
  }
}
