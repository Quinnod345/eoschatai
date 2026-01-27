import { db } from '@/lib/db';
import { document, userDocuments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import type { ComposerKind } from '@/lib/mentions/types';

/**
 * Options for document conversion
 */
export interface ConversionOptions {
  aiEnhance?: boolean; // Use AI to improve/restructure content
  preserveFormatting?: boolean; // Try to preserve original formatting
  generateSummary?: boolean; // Generate a content summary
  autoDetectKind?: boolean; // Auto-detect the best composer kind
  tags?: string[]; // Initial tags to add
  category?: string; // Category to assign
}

/**
 * Result of a conversion operation
 */
export interface ConversionResult {
  success: boolean;
  composerId?: string;
  kind?: ComposerKind;
  title?: string;
  content?: string;
  contentSummary?: string;
  suggestedTags?: string[];
  conversionNotes?: string;
  error?: string;
}

/**
 * Kind detection result
 */
export interface KindDetectionResult {
  kind: ComposerKind;
  confidence: number;
  reasoning: string;
}

/**
 * Category to composer kind mapping
 */
const CATEGORY_KIND_MAP: Record<string, ComposerKind> = {
  Scorecard: 'sheet',
  VTO: 'vto',
  Rocks: 'text',
  'A/C': 'accountability',
  'Core Process': 'text',
  'Persona Document': 'text',
  Other: 'text',
};

/**
 * Convert a UserDocument (uploaded file) to a Composer document
 */
export async function convertUserDocumentToComposer(
  userDocumentId: string,
  userId: string,
  options: ConversionOptions = {},
): Promise<ConversionResult> {
  try {
    // Fetch the source document
    const [sourceDoc] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, userDocumentId),
          eq(userDocuments.userId, userId),
        ),
      )
      .limit(1);

    if (!sourceDoc) {
      return {
        success: false,
        error: 'Source document not found',
      };
    }

    // Determine the target kind
    let targetKind: ComposerKind;
    let kindDetection: KindDetectionResult | null = null;

    if (options.autoDetectKind) {
      kindDetection = await detectOptimalComposerKind(
        sourceDoc.content,
        sourceDoc.category,
        sourceDoc.fileName,
      );
      targetKind = kindDetection.kind;
    } else {
      // Use category mapping
      targetKind = CATEGORY_KIND_MAP[sourceDoc.category] || 'text';
    }

    // Process the content
    let processedContent = sourceDoc.content;
    let contentSummary: string | undefined;
    let suggestedTags: string[] = [];

    if (options.aiEnhance) {
      const enhanced = await enhanceContentForComposer(
        sourceDoc.content,
        targetKind,
        {
          fileName: sourceDoc.fileName,
          category: sourceDoc.category,
          preserveFormatting: options.preserveFormatting,
        },
      );
      processedContent = enhanced.content;
      contentSummary = enhanced.summary;
      suggestedTags = enhanced.suggestedTags;
    } else if (options.generateSummary) {
      contentSummary = await generateContentSummary(processedContent, targetKind);
    }

    // Format content based on kind
    const formattedContent = formatContentForKind(processedContent, targetKind);

    // Create the new composer document
    const title = sourceDoc.fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    const [newComposer] = await db
      .insert(document)
      .values({
        title,
        content: formattedContent,
        kind: targetKind,
        userId,
        createdAt: new Date(),
        contentSummary,
        tags: [...(options.tags || []), ...suggestedTags],
        category: options.category || sourceDoc.category,
        sourceDocumentId: userDocumentId,
      })
      .returning();

    return {
      success: true,
      composerId: newComposer.id,
      kind: targetKind,
      title,
      content: formattedContent,
      contentSummary,
      suggestedTags,
      conversionNotes: kindDetection
        ? `Auto-detected as ${targetKind} with ${Math.round(kindDetection.confidence * 100)}% confidence. ${kindDetection.reasoning}`
        : `Converted from ${sourceDoc.category} category to ${targetKind} composer.`,
    };
  } catch (error) {
    console.error('Error converting document to composer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during conversion',
    };
  }
}

/**
 * Detect the optimal composer kind for content
 */
export async function detectOptimalComposerKind(
  content: string,
  category: string,
  fileName?: string,
): Promise<KindDetectionResult> {
  // Quick heuristics first
  const lowerContent = content.toLowerCase();
  const lowerFileName = fileName?.toLowerCase() || '';

  // Check for VTO structure
  if (
    category === 'VTO' ||
    lowerContent.includes('core values') ||
    lowerContent.includes('10-year target') ||
    lowerContent.includes('3-year picture') ||
    lowerContent.includes('marketing strategy')
  ) {
    return {
      kind: 'vto',
      confidence: 0.9,
      reasoning: 'Content contains VTO-specific sections like Core Values or strategic targets.',
    };
  }

  // Check for accountability chart structure
  if (
    category === 'A/C' ||
    lowerContent.includes('accountability chart') ||
    lowerContent.includes('seat holder') ||
    lowerContent.includes('integrator') ||
    lowerContent.includes('visionary')
  ) {
    return {
      kind: 'accountability',
      confidence: 0.9,
      reasoning: 'Content contains organizational structure and role definitions.',
    };
  }

  // Check for spreadsheet/tabular data
  if (
    category === 'Scorecard' ||
    lowerFileName.includes('.csv') ||
    lowerFileName.includes('.xlsx') ||
    content.includes('\t') ||
    (content.match(/,/g)?.length || 0) > 10 ||
    content.includes('|')
  ) {
    return {
      kind: 'sheet',
      confidence: 0.85,
      reasoning: 'Content appears to be tabular data or metrics.',
    };
  }

  // Check for code
  if (
    lowerFileName.match(/\.(js|ts|py|java|cpp|c|go|rs|rb|php|swift|kt)$/) ||
    content.includes('function ') ||
    content.includes('class ') ||
    content.includes('import ') ||
    content.includes('const ') ||
    content.includes('def ')
  ) {
    return {
      kind: 'code',
      confidence: 0.85,
      reasoning: 'Content contains programming code patterns.',
    };
  }

  // Use AI for uncertain cases
  try {
    const result = await generateText({
      model: myProvider.languageModel('gpt-4o-mini'),
      system: `You are a document classifier. Analyze the content and determine the best composer type.
      
Available types:
- text: General text documents, notes, articles, SOPs
- code: Programming code, scripts
- sheet: Spreadsheet data, tables, metrics, scorecards
- chart: Data that would be best visualized as a chart
- vto: EOS Vision/Traction Organizer documents
- accountability: EOS Accountability Charts, org structures

Respond with JSON: { "kind": "text|code|sheet|chart|vto|accountability", "confidence": 0.0-1.0, "reasoning": "brief explanation" }`,
      prompt: `Category: ${category}
File name: ${fileName || 'unknown'}
Content preview (first 2000 chars):
${content.slice(0, 2000)}`,
      maxOutputTokens: 150,
    });

    try {
      const parsed = JSON.parse(result.text);
      return {
        kind: parsed.kind as ComposerKind,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      };
    } catch {
      // Fall through to default
    }
  } catch (error) {
    console.error('AI kind detection failed:', error);
  }

  // Default to text
  return {
    kind: 'text',
    confidence: 0.5,
    reasoning: 'Could not determine specific type, defaulting to text document.',
  };
}

/**
 * Enhance content using AI for better composer format
 */
async function enhanceContentForComposer(
  content: string,
  kind: ComposerKind,
  context: { fileName: string; category: string; preserveFormatting?: boolean },
): Promise<{ content: string; summary: string; suggestedTags: string[] }> {
  const preserveNote = context.preserveFormatting
    ? 'Preserve the original structure and formatting as much as possible.'
    : 'Improve the structure and formatting for better readability.';

  const kindInstructions: Record<ComposerKind, string> = {
    text: 'Format as clean markdown with proper headings, lists, and paragraphs.',
    code: 'Ensure proper code formatting with syntax highlighting hints.',
    sheet: 'Structure as CSV-compatible data with clear headers.',
    chart: 'Extract key data points suitable for visualization.',
    image: 'This should not be converted - images cannot be enhanced.',
    vto: 'Structure according to EOS V/TO format with all standard sections.',
    accountability: 'Format as a hierarchical accountability chart with clear roles.',
  };

  try {
    const result = await generateText({
      model: myProvider.languageModel('gpt-4o-mini'),
      system: `You are a document formatter. Transform the content for a ${kind} composer document.
      
${kindInstructions[kind]}
${preserveNote}

Also provide:
1. A brief summary (1-2 sentences)
2. 3-5 relevant tags for categorization

Respond with JSON:
{
  "content": "formatted content here",
  "summary": "brief summary",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`,
      prompt: `Original document: ${context.fileName}
Category: ${context.category}
Content:
${content.slice(0, 8000)}`,
      maxOutputTokens: 4000,
    });

    try {
      const parsed = JSON.parse(result.text);
      return {
        content: parsed.content,
        summary: parsed.summary,
        suggestedTags: parsed.suggestedTags || [],
      };
    } catch {
      // Return original content if parsing fails
      return {
        content,
        summary: '',
        suggestedTags: [],
      };
    }
  } catch (error) {
    console.error('Content enhancement failed:', error);
    return {
      content,
      summary: '',
      suggestedTags: [],
    };
  }
}

/**
 * Generate a summary for content
 */
async function generateContentSummary(
  content: string,
  kind: ComposerKind,
): Promise<string> {
  try {
    const result = await generateText({
      model: myProvider.languageModel('gpt-4o-mini'),
      system: `Generate a brief 1-2 sentence summary of this ${kind} document content. Be concise and capture the main purpose or topic.`,
      prompt: content.slice(0, 4000),
      maxOutputTokens: 100,
    });
    return result.text.trim();
  } catch (error) {
    console.error('Summary generation failed:', error);
    return '';
  }
}

/**
 * Format content based on composer kind
 */
function formatContentForKind(content: string, kind: ComposerKind): string {
  switch (kind) {
    case 'sheet':
      // Ensure CSV-like format
      if (!content.includes(',') && !content.includes('\t')) {
        // Try to convert space-separated to CSV
        return content
          .split('\n')
          .map((line) => line.trim().split(/\s{2,}/).join(','))
          .join('\n');
      }
      return content;

    case 'vto':
      // Wrap in VTO markers if not present
      if (!content.includes('VTO_DATA_BEGIN')) {
        return `VTO_DATA_BEGIN\n${content}\nVTO_DATA_END`;
      }
      return content;

    case 'accountability':
      // Wrap in AC markers if not present
      if (!content.includes('AC_DATA_BEGIN')) {
        return `AC_DATA_BEGIN\n${content}\nAC_DATA_END`;
      }
      return content;

    case 'chart':
      // Wrap in chart markers if not present
      if (!content.includes('CHART_DATA_BEGIN')) {
        return `CHART_DATA_BEGIN\n${content}\nCHART_DATA_END`;
      }
      return content;

    default:
      return content;
  }
}

/**
 * Get conversion suggestions for a UserDocument
 */
export async function getConversionSuggestions(
  userDocumentId: string,
  userId: string,
): Promise<{
  suggestedKind: ComposerKind;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ kind: ComposerKind; reasoning: string }>;
}> {
  const [sourceDoc] = await db
    .select()
    .from(userDocuments)
    .where(
      and(eq(userDocuments.id, userDocumentId), eq(userDocuments.userId, userId)),
    )
    .limit(1);

  if (!sourceDoc) {
    throw new Error('Document not found');
  }

  const detection = await detectOptimalComposerKind(
    sourceDoc.content,
    sourceDoc.category,
    sourceDoc.fileName,
  );

  // Generate alternatives
  const alternatives: Array<{ kind: ComposerKind; reasoning: string }> = [];
  const allKinds: ComposerKind[] = ['text', 'code', 'sheet', 'chart', 'vto', 'accountability'];

  for (const kind of allKinds) {
    if (kind !== detection.kind && kind !== 'image') {
      alternatives.push({
        kind,
        reasoning: getAlternativeReasoning(kind, sourceDoc.category),
      });
    }
  }

  return {
    suggestedKind: detection.kind,
    confidence: detection.confidence,
    reasoning: detection.reasoning,
    alternatives: alternatives.slice(0, 3), // Top 3 alternatives
  };
}

/**
 * Get reasoning for alternative composer kinds
 */
function getAlternativeReasoning(kind: ComposerKind, category: string): string {
  const reasons: Record<ComposerKind, string> = {
    text: 'Convert to a general text document for editing and annotation.',
    code: 'Convert to code format if the content contains scripts or technical instructions.',
    sheet: 'Convert to spreadsheet for tabular data analysis.',
    chart: 'Convert to chart for data visualization.',
    image: 'Images cannot be converted from text.',
    vto: 'Convert to V/TO format for strategic planning documents.',
    accountability: 'Convert to accountability chart for organizational structure.',
  };
  return reasons[kind];
}
