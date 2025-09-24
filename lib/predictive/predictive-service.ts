import { generateText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';
import natural from 'natural';

const trieCache = new Map<string, natural.Trie>();

interface PredictiveContext {
  chatId?: string;
  personaId?: string;
  visibility?: string;
  composerDocumentId?: string;
  selectedModelId?: string;
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
    source: 'fasttext' | 'nano';
    prefix: string;
    eosScore?: number;
    nanoModel?: string;
  };
}

export async function getPredictiveSuggestions({
  prefix,
  user,
  context,
}: PredictiveRequest): Promise<PredictiveResult> {
  const normalized = prefix.trim();
  if (!normalized) {
    return { predictions: [], metadata: { source: 'fasttext', prefix } };
  }

  const trie = await loadTrieForUser(user.id);
  const nGramSuggestions = getTrieSuggestions(trie, normalized);

  if (nGramSuggestions.length >= 3) {
    return {
      predictions: nGramSuggestions,
      metadata: { source: 'fasttext', prefix },
    };
  }

  const fallback = await getNanoPrediction({ prefix: normalized, context });
  const combined = [...new Set([...nGramSuggestions, ...fallback.predictions])];

  return {
    predictions: combined.slice(0, 5),
    metadata: {
      source: fallback.metadata.source,
      prefix,
      eosScore: fallback.metadata.eosScore,
      nanoModel: fallback.metadata.nanoModel,
    },
  };
}

async function loadTrieForUser(userId: string) {
  if (trieCache.has(userId)) {
    return trieCache.get(userId)!;
  }

  const trie = new natural.Trie();

  const seeds = [
    'What are my Level 10 meeting headlines today',
    'Show my EOS Scorecard metrics for this week',
    'Help me prepare for my EOS quarterly planning session',
    'Summarize the issues list from our last meeting',
    'Draft a follow-up email for the IDS topics we resolved',
    'Outline my next steps for the EOS implementation roadmap',
    'Analyze team accountability gaps from the People Analyzer',
  ];

  for (const seed of seeds) {
    trie.addString(seed.toLowerCase());
  }

  trieCache.set(userId, trie);
  return trie;
}

function getTrieSuggestions(trie: natural.Trie, prefix: string) {
  const lowerPrefix = prefix.toLowerCase();
  const candidates = trie.keysWithPrefix(lowerPrefix) || [];
  return candidates
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > prefix.length)
    .slice(0, 5);
}

async function getNanoPrediction({
  prefix,
  context,
}: {
  prefix: string;
  context?: PredictiveContext;
}): Promise<PredictiveResult> {
  try {
    const provider = createCustomProvider();
    const { text } = await generateText({
      model: provider.languageModel('gpt-4.1-nano'),
      temperature: 0.3,
      maxTokens: 60,
      system: `You are EOS Chat's predictive composer, optimized for EOS terminology.
Generate up to 5 likely completions that help EOS leaders finish their question succinctly.
Focus on Level 10 meetings, IDS, Scorecards, Rocks, accountability, and EOS cadence.
Return items separated by newline. Do not include numbering or commentary.`,
      prompt: buildNanoPrompt(prefix, context),
    });

    const predictions = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    return {
      predictions,
      metadata: {
        source: 'nano',
        prefix,
        nanoModel: 'gpt-4.1-nano',
        eosScore: calculateEosScore(predictions),
      },
    };
  } catch (error) {
    console.error('Nano predictive fallback failed', error);
    return { predictions: [], metadata: { source: 'nano', prefix } };
  }
}

function buildNanoPrompt(prefix: string, context?: PredictiveContext) {
  const lines = [`User prefix: "${prefix}"`];

  if (context?.personaId) {
    lines.push(`Persona: ${context.personaId}`);
  }
  if (context?.visibility) {
    lines.push(`Visibility: ${context.visibility}`);
  }
  if (context?.selectedModelId) {
    lines.push(`Selected Model: ${context.selectedModelId}`);
  }
  if (context?.composerDocumentId) {
    lines.push(`Composer Document: ${context.composerDocumentId}`);
  }

  lines.push('Output:');
  return lines.join('\n');
}

function calculateEosScore(predictions: string[]) {
  const eosKeywords = [
    'level 10',
    'scorecard',
    'rocks',
    'ids',
    'traction',
    'vto',
    'accountability',
  ];

  const combined = predictions.join(' ').toLowerCase();
  let score = 0;
  for (const keyword of eosKeywords) {
    if (combined.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}
