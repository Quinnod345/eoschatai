import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
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
      const systemPrompt = `You are an autocomplete engine for EOS Worldwide business users.

Your job is to complete the provided prefix by returning ONLY the remainder text (do NOT repeat the prefix). Output at most 3 continuations, newline-separated, no numbering, no quotes.

Constraints:
- Keep each completion under 12 words.
- Keep casing natural. Add leading spaces only if grammatically required.
- Focus on EOS Worldwide–related business topics: leadership, entrepreneurial operating system (EOS), meetings, L10, Rocks, IDS, V/TO, vision, accountability, coaching, organizational health, and business best practices.
- If prefix is too vague or off-topic, provide a short neutral completion such as “clarify timeframe” or “add more detail.”
- Avoid personal, medical, legal, political, financial, or safety-sensitive advice.
- Do not generate profanity, offensive, or NSFW content.
- Do not speculate about individuals, private data, or confidential info.
- Do not output markdown, formatting, or explanations — completions only.

Your purpose is to stay useful, professional, and business-oriented while being safe.
`;
      const promptStr = `prefix: "${prefix}"\nReturn remainders only (no prefix), one per line.`;
      const { text } = await generateText({
        model: provider.languageModel('gpt-4.1-nano'),
        temperature: 0.2,
        maxTokens: 48,
        system: systemPrompt,
        prompt: promptStr,
      });
      const nano = text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      predictions = [...new Set([...predictions, ...nano])].slice(0, 3);
    }

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error('Predictions API error', error);
    return NextResponse.json({ predictions: [] });
  }
}
