import { generateText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';
import natural from 'natural';

const trieCache = new Map<string, natural.Trie>();

// Keyword categories for intent detection
const QUESTION_WORDS = ['how', 'what', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does'];
const ACTION_WORDS = ['help', 'create', 'write', 'draft', 'summarize', 'analyze', 'explain', 'list', 'show', 'find', 'generate', 'make', 'build', 'prepare', 'outline', 'review'];
const EOS_TERMS = ['rock', 'rocks', 'vto', 'v/to', 'l10', 'level 10', 'scorecard', 'ids', 'issue', 'issues', 'accountability', 'chart', 'people analyzer', 'traction', 'eos', 'quarterly', 'meeting', 'headline', 'todo', 'to-do'];
const DOCUMENT_ACTIONS = ['edit', 'update', 'revise', 'rewrite', 'expand', 'add', 'remove', 'change', 'fix', 'improve', 'format'];

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
    source: 'trie' | 'ai' | 'contextual';
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

/**
 * Detect the intent of the user's query based on keywords
 */
function detectIntent(prefix: string): QueryIntent {
  const lower = prefix.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || '';
  const firstWord = words[0] || '';
  
  const detectedKeywords: string[] = [];
  
  // Check for question words
  const hasQuestionWord = QUESTION_WORDS.some(qw => {
    if (lower.startsWith(`${qw} `) || lower.includes(` ${qw} `)) {
      detectedKeywords.push(qw);
      return true;
    }
    return false;
  });
  
  // Check for action words
  const hasActionWord = ACTION_WORDS.some(aw => {
    if (lower.startsWith(`${aw} `) || lower.includes(` ${aw} `)) {
      detectedKeywords.push(aw);
      return true;
    }
    return false;
  });
  
  // Check for document editing actions
  const hasDocumentAction = DOCUMENT_ACTIONS.some(da => {
    if (lower.startsWith(`${da} `) || lower.includes(` ${da} `)) {
      detectedKeywords.push(da);
      return true;
    }
    return false;
  });
  
  // Check for EOS terms
  const hasEosTerm = EOS_TERMS.some(term => {
    if (lower.includes(term)) {
      detectedKeywords.push(term);
      return true;
    }
    return false;
  });
  
  // Check if last word is partial (no trailing space and not a complete common word)
  const isPartialWord = !prefix.endsWith(' ') && lastWord.length > 0 && lastWord.length < 4;
  
  // Determine intent type
  let type: QueryIntent['type'] = 'unknown';
  if (hasDocumentAction) {
    type = 'document_edit';
  } else if (hasQuestionWord || firstWord.endsWith('?') || lower.endsWith('?')) {
    type = 'question';
  } else if (hasActionWord) {
    type = 'action';
  } else if (words.length > 2) {
    type = 'statement';
  }
  
  return {
    type,
    hasEosTerm,
    detectedKeywords,
    isPartialWord,
    lastWord,
  };
}

/**
 * Get contextual completions based on intent and context
 */
function getContextualCompletions(intent: QueryIntent, context?: PredictiveContext): string[] {
  const completions: string[] = [];
  
  // If composer is open, suggest document editing actions
  if (context?.composerDocumentId) {
    if (intent.type === 'unknown' || intent.type === 'document_edit') {
      completions.push(
        'the document to be more detailed',
        'more examples to illustrate the points',
        'a summary at the end',
        'transitions between sections',
      );
    }
  }
  
  // EOS-specific completions based on detected terms
  if (intent.hasEosTerm) {
    if (intent.detectedKeywords.includes('rock') || intent.detectedKeywords.includes('rocks')) {
      completions.push(
        'for this quarter',
        'progress and status',
        'that are on track',
        'that need attention',
      );
    }
    if (intent.detectedKeywords.includes('l10') || intent.detectedKeywords.includes('level 10')) {
      completions.push(
        'meeting agenda',
        'meeting headlines',
        'meeting issues to discuss',
        'meeting scorecard review',
      );
    }
    if (intent.detectedKeywords.includes('scorecard')) {
      completions.push(
        'metrics for this week',
        'trends over time',
        'items that are off track',
      );
    }
    if (intent.detectedKeywords.includes('accountability')) {
      completions.push(
        'chart for the team',
        'gaps to address',
        'structure improvements',
      );
    }
    if (intent.detectedKeywords.includes('vto') || intent.detectedKeywords.includes('v/to')) {
      completions.push(
        'core values',
        'core focus',
        '10-year target',
        'marketing strategy',
      );
    }
  }
  
  // Question-type completions
  if (intent.type === 'question') {
    if (intent.detectedKeywords.includes('how')) {
      completions.push(
        'to improve our process',
        'to track progress effectively',
        'to run a better meeting',
      );
    }
    if (intent.detectedKeywords.includes('what')) {
      completions.push(
        'should we focus on',
        'are the next steps',
        'are the key priorities',
      );
    }
  }
  
  // Action-type completions
  if (intent.type === 'action') {
    if (intent.detectedKeywords.includes('help')) {
      completions.push(
        'me prepare for the meeting',
        'me understand the metrics',
        'me draft an email',
      );
    }
    if (intent.detectedKeywords.includes('create') || intent.detectedKeywords.includes('draft')) {
      completions.push(
        'an action plan',
        'a summary document',
        'meeting notes',
      );
    }
    if (intent.detectedKeywords.includes('summarize') || intent.detectedKeywords.includes('analyze')) {
      completions.push(
        'the key findings',
        'the main issues',
        'the performance data',
      );
    }
  }
  
  return completions;
}

/**
 * Validate and filter predictions to ensure quality
 */
function validatePredictions(predictions: string[], prefix: string, intent: QueryIntent): string[] {
  const prefixLower = prefix.toLowerCase().trim();
  const prefixWords = prefixLower.split(/\s+/);
  
  return predictions.filter(pred => {
    const predLower = pred.toLowerCase().trim();
    
    // Skip empty predictions
    if (!predLower || predLower.length < 2) return false;
    
    // Skip if prediction is too long (more than 10 words)
    if (pred.split(/\s+/).length > 10) return false;
    
    // Skip if prediction just repeats the prefix
    if (predLower === prefixLower) return false;
    
    // Skip if prediction starts with prefix (should be a continuation, not repetition)
    if (predLower.startsWith(prefixLower)) return false;
    
    // Skip if prediction contains the last few words of prefix (to avoid weird loops)
    const lastThreeWords = prefixWords.slice(-3).join(' ');
    if (lastThreeWords.length > 5 && predLower.includes(lastThreeWords)) return false;
    
    // Skip if prediction looks like a full answer (common AI mistakes)
    if (
      predLower.startsWith('i ') ||
      predLower.startsWith('you ') ||
      predLower.startsWith('the answer') ||
      predLower.startsWith('here is') ||
      predLower.startsWith('here are') ||
      predLower.includes('...') ||
      predLower.includes('certainly')
    ) {
      return false;
    }
    
    // Skip predictions that start with question words (they're completing, not asking new questions)
    if (QUESTION_WORDS.some(qw => predLower.startsWith(`${qw} `))) {
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
  
  // Don't suggest for very short prefixes (less than 3 chars)
  if (normalized.length < 3) {
    return { predictions: [], metadata: { source: 'trie', prefix } };
  }
  
  // Detect intent for smarter suggestions
  const intent = detectIntent(normalized);
  
  // Get contextual completions first (fast, no API call)
  const contextualCompletions = getContextualCompletions(intent, context);
  
  // Get trie-based suggestions
  const trie = await loadTrieForUser(user.id);
  const trieSuggestions = getTrieSuggestions(trie, normalized);
  
  // Combine contextual and trie suggestions
  const localSuggestions = [...contextualCompletions, ...trieSuggestions];
  const validatedLocal = validatePredictions(localSuggestions, normalized, intent);
  
  // If we have enough good local suggestions, use them
  if (validatedLocal.length >= 3) {
    return {
      predictions: validatedLocal.slice(0, 3),
      metadata: { 
        source: 'contextual', 
        prefix, 
        intent,
        eosScore: calculateEosScore(validatedLocal),
      },
    };
  }
  
  // Fall back to AI suggestions
  try {
    const fallback = await getAIPrediction({ prefix: normalized, context, intent });
    const validatedAI = validatePredictions(fallback.predictions, normalized, intent);
    
    // Combine all suggestions, prioritizing local ones
    const combined = [...new Set([...validatedLocal, ...validatedAI])];
    const finalPredictions = combined.slice(0, 3);
    
    return {
      predictions: finalPredictions,
      metadata: {
        source: validatedLocal.length > 0 ? 'contextual' : 'ai',
        prefix,
        intent,
        eosScore: calculateEosScore(finalPredictions),
      },
    };
  } catch (error) {
    console.error('AI predictive fallback failed:', error);
    return { 
      predictions: validatedLocal.slice(0, 3), 
      metadata: { source: 'contextual', prefix, intent },
    };
  }
}

async function loadTrieForUser(userId: string) {
  const cached = trieCache.get(userId);
  if (cached) {
    return cached;
  }

  const trie = new natural.Trie();

  // Expanded seed phrases for better coverage
  const seeds = [
    // Level 10 meetings
    'level 10 meeting headlines today',
    'level 10 meeting agenda',
    'level 10 meeting issues',
    'l10 meeting preparation',
    // Scorecards
    'scorecard metrics for this week',
    'scorecard trends and analysis',
    'scorecard items off track',
    // Rocks
    'rocks for this quarter',
    'rocks progress update',
    'rocks that need attention',
    // VTO
    'vto core values',
    'vto core focus',
    'vto ten year target',
    'vto marketing strategy',
    // Accountability
    'accountability chart review',
    'accountability gaps',
    'people analyzer results',
    // IDS
    'ids topics to discuss',
    'ids process for issues',
    'issues to solve today',
    // General
    'quarterly planning session',
    'quarterly review preparation',
    'team performance analysis',
    'meeting notes summary',
    'action items from meeting',
    'follow up email draft',
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
  
  // Return the remainder (continuation) rather than full match
  return candidates
    .map((candidate) => {
      const remainder = candidate.slice(lowerPrefix.length).trim();
      return remainder;
    })
    .filter((remainder) => remainder.length > 0 && remainder.length < 50)
    .slice(0, 5);
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
    const provider = createCustomProvider();
    
    // Build a smarter system prompt based on intent
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
      systemPrompt += `\n7. User has a document open - suggest document editing completions if relevant`;
    }
    
    if (intent.type === 'question') {
      systemPrompt += `\n8. User is asking a question - complete the question topic, don't answer it`;
    } else if (intent.type === 'action') {
      systemPrompt += `\n8. User wants to do something - complete with the target/object of the action`;
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

function buildAIPrompt(prefix: string, context?: PredictiveContext, intent?: QueryIntent) {
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
    lines.push(`Has document open: yes (kind: ${context.composerKind || 'unknown'})`);
  }
  if (context?.isNewChat) {
    lines.push(`New conversation: yes`);
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
