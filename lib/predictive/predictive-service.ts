import { generateText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';

const EOS_TERMS = [
  'rock',
  'rocks',
  'vto',
  'v/to',
  'l10',
  'level 10',
  'scorecard',
  'ids',
  'issue',
  'issues',
  'accountability',
  'chart',
  'people analyzer',
  'traction',
  'eos',
  'quarterly',
  'meeting',
  'headline',
  'todo',
  'to-do',
  'measurable',
  'process',
  'core value',
  'core focus',
  '10-year target',
  'three year picture',
  'marketing strategy',
  'quarterly conversation',
  'gto',
  'delegate',
  'elevate',
];

const QUESTION_WORDS = [
  'how',
  'what',
  'why',
  'when',
  'where',
  'who',
  'which',
  'can',
  'could',
  'would',
  'should',
  'is',
  'are',
  'do',
  'does',
];

const ACTION_WORDS = [
  'help',
  'create',
  'write',
  'draft',
  'summarize',
  'analyze',
  'explain',
  'list',
  'show',
  'find',
  'generate',
  'make',
  'build',
  'prepare',
  'outline',
  'review',
  'compare',
  'suggest',
  'recommend',
];

const DOCUMENT_ACTIONS = [
  'edit',
  'update',
  'revise',
  'rewrite',
  'expand',
  'add',
  'remove',
  'change',
  'fix',
  'improve',
  'format',
];

interface PredictiveContext {
  chatId?: string;
  personaId?: string;
  personaName?: string;
  visibility?: string;
  composerDocumentId?: string;
  composerKind?: string;
  selectedModelId?: string;
  isNewChat?: boolean;
}

interface PredictiveRequest {
  prefix: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  context?: PredictiveContext;
}

interface PredictiveResult {
  predictions: string[];
  metadata: {
    source: 'contextual' | 'ai' | 'hybrid';
    prefix: string;
    intent?: QueryIntent;
    eosScore?: number;
  };
}

interface QueryIntent {
  type: 'question' | 'action' | 'statement' | 'document_edit' | 'unknown';
  hasEosTerm: boolean;
  detectedKeywords: string[];
  isPartialWord: boolean;
  lastWord: string;
}

function detectIntent(prefix: string): QueryIntent {
  const lower = prefix.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || '';
  const firstWord = words[0] || '';

  const detectedKeywords: string[] = [];

  const hasQuestionWord = QUESTION_WORDS.some((qw) => {
    if (lower.startsWith(`${qw} `) || lower.includes(` ${qw} `)) {
      detectedKeywords.push(qw);
      return true;
    }
    return false;
  });

  const hasActionWord = ACTION_WORDS.some((aw) => {
    if (lower.startsWith(`${aw} `) || lower.includes(` ${aw} `)) {
      detectedKeywords.push(aw);
      return true;
    }
    return false;
  });

  const hasDocumentAction = DOCUMENT_ACTIONS.some((da) => {
    if (lower.startsWith(`${da} `) || lower.includes(` ${da} `)) {
      detectedKeywords.push(da);
      return true;
    }
    return false;
  });

  const hasEosTerm = EOS_TERMS.some((term) => {
    if (lower.includes(term)) {
      detectedKeywords.push(term);
      return true;
    }
    return false;
  });

  const isPartialWord =
    !prefix.endsWith(' ') && lastWord.length > 0 && lastWord.length < 4;

  let type: QueryIntent['type'] = 'unknown';
  if (hasDocumentAction) {
    type = 'document_edit';
  } else if (
    hasQuestionWord ||
    firstWord.endsWith('?') ||
    lower.endsWith('?')
  ) {
    type = 'question';
  } else if (hasActionWord) {
    type = 'action';
  } else if (words.length > 2) {
    type = 'statement';
  }

  return { type, hasEosTerm, detectedKeywords, isPartialWord, lastWord };
}

// ─── Contextual completions ────────────────────────────────────

const COMPLETION_MAP: Record<string, string[]> = {
  rock: [
    'for this quarter',
    'progress and status',
    'that are on track',
    'that need attention',
    'milestones',
  ],
  rocks: [
    'for this quarter',
    'progress and status',
    'that are on track',
    'that need attention',
    'milestones',
  ],
  l10: [
    'meeting agenda',
    'meeting headlines',
    'meeting issues to discuss',
    'meeting scorecard review',
  ],
  'level 10': [
    'meeting agenda',
    'meeting headlines',
    'meeting issues to discuss',
    'meeting scorecard review',
  ],
  scorecard: [
    'metrics for this week',
    'trends over time',
    'items that are off track',
    'review for the team',
  ],
  accountability: [
    'chart for the team',
    'gaps to address',
    'structure improvements',
    'chart review',
  ],
  vto: [
    'core values',
    'core focus',
    '10-year target',
    'marketing strategy',
    'three year picture',
  ],
  'v/to': ['core values', 'core focus', '10-year target', 'marketing strategy'],
  ids: ['topics to discuss', 'process for issues', 'priority issues'],
  how: [
    'to improve our process',
    'to track progress effectively',
    'to run a better meeting',
    'to set better rocks',
  ],
  what: [
    'should we focus on',
    'are the next steps',
    'are the key priorities',
    'measurables are off track',
  ],
  help: [
    'me prepare for the meeting',
    'me understand the metrics',
    'me draft an email',
    'me review my rocks',
  ],
  create: [
    'an action plan',
    'a summary document',
    'meeting notes',
    'a new rock',
    'a scorecard',
  ],
  draft: [
    'an action plan',
    'a summary document',
    'meeting notes',
    'a follow-up email',
  ],
  summarize: [
    'the key findings',
    'the main issues',
    'the performance data',
    'the meeting discussion',
  ],
  analyze: [
    'the key findings',
    'the main issues',
    'the performance data',
    'the team scorecard',
  ],
  show: [
    'my rocks for this quarter',
    'my scorecard',
    'the issues list',
    'upcoming meetings',
  ],
  find: [
    'available time for a meeting',
    'off-track measurables',
    'open issues',
  ],
};

function getContextualCompletions(
  intent: QueryIntent,
  prefix: string,
  context?: PredictiveContext,
): string[] {
  const lower = prefix.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  const completions: string[] = [];

  if (
    context?.composerDocumentId &&
    (intent.type === 'unknown' || intent.type === 'document_edit')
  ) {
    completions.push(
      'the document to be more detailed',
      'more examples to illustrate the points',
      'a summary at the end',
      'transitions between sections',
    );
  }

  for (const keyword of intent.detectedKeywords) {
    const matches = COMPLETION_MAP[keyword];
    if (matches) {
      completions.push(...matches);
    }
  }

  if (completions.length === 0 && words.length > 0) {
    const lastWord = words[words.length - 1];
    const matches = COMPLETION_MAP[lastWord];
    if (matches) {
      completions.push(...matches);
    }
  }

  return completions;
}

// ─── Hybrid ranker ─────────────────────────────────────────────

interface RankedCompletion {
  text: string;
  score: number;
}

function rankCompletions(
  completions: string[],
  prefix: string,
  intent: QueryIntent,
): RankedCompletion[] {
  const lower = prefix.toLowerCase();
  const prefixWords = lower.split(/\s+/);

  return completions.map((text) => {
    let score = 0;
    const textLower = text.toLowerCase();
    const textWords = textLower.split(/\s+/);

    // EOS relevance: boost completions containing EOS terms
    for (const term of EOS_TERMS) {
      if (textLower.includes(term)) score += 15;
    }

    // Intent alignment: boost completions matching the detected intent
    if (
      intent.type === 'question' &&
      textWords.some((w) => ['for', 'about', 'to'].includes(w))
    ) {
      score += 8;
    }
    if (intent.type === 'action' && textWords.length <= 5) {
      score += 5;
    }

    // Penalize word overlap with prefix
    const overlap = prefixWords.filter(
      (pw) => pw.length > 3 && textWords.includes(pw),
    ).length;
    score -= overlap * 20;

    // Prefer shorter, more natural completions (2-5 words sweet spot)
    if (textWords.length >= 2 && textWords.length <= 5) {
      score += 10;
    } else if (textWords.length > 8) {
      score -= 10;
    }

    // Keyword continuity: if prefix last word is partial and completion starts matching
    if (intent.isPartialWord && intent.lastWord.length > 0) {
      if (textLower.startsWith(intent.lastWord)) {
        score += 12;
      }
    }

    return { text, score };
  });
}

function validatePredictions(predictions: string[], prefix: string): string[] {
  const prefixLower = prefix.toLowerCase().trim();
  const prefixWords = prefixLower.split(/\s+/);

  return predictions.filter((pred) => {
    const predLower = pred.toLowerCase().trim();

    if (!predLower || predLower.length < 2) return false;
    if (pred.split(/\s+/).length > 10) return false;
    if (predLower === prefixLower) return false;
    if (predLower.startsWith(prefixLower)) return false;

    const lastThreeWords = prefixWords.slice(-3).join(' ');
    if (lastThreeWords.length > 5 && predLower.includes(lastThreeWords))
      return false;

    if (
      predLower.startsWith('i ') ||
      predLower.startsWith('you ') ||
      predLower.startsWith('the answer') ||
      predLower.startsWith('here is') ||
      predLower.startsWith('here are') ||
      predLower.includes('certainly')
    ) {
      return false;
    }

    return true;
  });
}

export async function getPredictiveSuggestions({
  prefix,
  user,
  context,
}: PredictiveRequest): Promise<PredictiveResult> {
  const normalized = prefix.trim();

  if (normalized.length < 3) {
    return { predictions: [], metadata: { source: 'contextual', prefix } };
  }

  const intent = detectIntent(normalized);
  const contextualCompletions = getContextualCompletions(
    intent,
    normalized,
    context,
  );
  const validated = validatePredictions(contextualCompletions, normalized);

  const ranked = rankCompletions(validated, normalized, intent);
  ranked.sort((a, b) => b.score - a.score);
  const localPredictions = ranked.map((r) => r.text);

  if (localPredictions.length >= 3) {
    return {
      predictions: localPredictions.slice(0, 3),
      metadata: {
        source: 'contextual',
        prefix,
        intent,
        eosScore: calculateEosScore(localPredictions),
      },
    };
  }

  try {
    const fallback = await getAIPrediction({
      prefix: normalized,
      context,
      intent,
    });
    const validatedAI = validatePredictions(fallback.predictions, normalized);
    const allRanked = rankCompletions(
      [...new Set([...localPredictions, ...validatedAI])],
      normalized,
      intent,
    );
    allRanked.sort((a, b) => b.score - a.score);
    const finalPredictions = allRanked.map((r) => r.text).slice(0, 3);

    return {
      predictions: finalPredictions,
      metadata: {
        source: localPredictions.length > 0 ? 'hybrid' : 'ai',
        prefix,
        intent,
        eosScore: calculateEosScore(finalPredictions),
      },
    };
  } catch (error) {
    console.error('AI predictive fallback failed:', error);
    return {
      predictions: localPredictions.slice(0, 3),
      metadata: { source: 'contextual', prefix, intent },
    };
  }
}

async function getAIPrediction({
  prefix,
  context,
  intent,
}: {
  prefix: string;
  context?: PredictiveContext;
  intent: QueryIntent;
}): Promise<PredictiveResult> {
  try {
    const provider = createCustomProvider('openai');

    let systemPrompt = `You are a text completion assistant for EOS (Entrepreneurial Operating System) business software.
Your job is to suggest SHORT CONTINUATIONS (2-6 words) to complete what the user is typing.

CRITICAL RULES:
1. Output ONLY the continuation text, NOT the full sentence
2. DO NOT answer questions - only suggest how to finish typing them
3. Keep completions SHORT: 2-6 words maximum
4. Output plain text, one per line, no numbering
5. DO NOT repeat any part of what the user already typed
6. Focus on EOS business terminology: Rocks, L10 meetings, Scorecards, V/TO, IDS, accountability`;

    if (context?.composerDocumentId) {
      systemPrompt +=
        '\n7. User has a document open - suggest document editing completions if relevant';
    }

    if (intent.type === 'question') {
      systemPrompt +=
        "\n8. User is asking a question - complete the question topic, don't answer it";
    } else if (intent.type === 'action') {
      systemPrompt +=
        '\n8. User wants to do something - complete with the target/object of the action';
    }

    const { text } = await generateText({
      model: provider.languageModel('preflight-model'),
      temperature: 0.2,
      maxOutputTokens: 50,
      system: systemPrompt,
      prompt: buildAIPrompt(prefix, context, intent),
    });

    const predictions = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    return {
      predictions,
      metadata: {
        source: 'ai',
        prefix,
        intent,
        eosScore: calculateEosScore(predictions),
      },
    };
  } catch (error) {
    console.error('AI prediction failed:', error);
    return { predictions: [], metadata: { source: 'ai', prefix } };
  }
}

function buildAIPrompt(
  prefix: string,
  context?: PredictiveContext,
  intent?: QueryIntent,
) {
  const lines = [`User is typing: "${prefix}"`];

  if (intent) {
    lines.push(`Detected intent: ${intent.type}`);
    if (intent.detectedKeywords.length > 0) {
      lines.push(`Keywords found: ${intent.detectedKeywords.join(', ')}`);
    }
  }

  if (context?.personaName) {
    lines.push(`Persona context: ${context.personaName}`);
  }
  if (context?.composerDocumentId) {
    lines.push(
      `Has document open: yes (kind: ${context.composerKind || 'unknown'})`,
    );
  }
  if (context?.isNewChat) {
    lines.push('New conversation: yes');
  }

  lines.push('\nSuggest 3 short continuations (2-6 words each):');
  return lines.join('\n');
}

function calculateEosScore(predictions: string[]) {
  const combined = predictions.join(' ').toLowerCase();
  let score = 0;
  for (const term of EOS_TERMS) {
    if (combined.includes(term)) {
      score += 1;
    }
  }
  return score;
}
