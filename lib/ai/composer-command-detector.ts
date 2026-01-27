import type { ComposerKind } from '@/lib/mentions/types';
import type { ProcessedMention } from './mention-processor';

/**
 * Types of commands that can be executed on composers
 */
export type ComposerCommandType =
  | 'edit' // Modify the content
  | 'view' // Open/view the composer
  | 'duplicate' // Create a copy
  | 'delete' // Remove the composer
  | 'share' // Share with others
  | 'export' // Export to different format
  | 'tag' // Add/remove tags
  | 'relate' // Create relationship to another composer
  | 'convert'; // Convert to different kind

/**
 * Detected composer command
 */
export interface ComposerCommand {
  type: ComposerCommandType;
  composerId: string;
  composerTitle?: string;
  composerKind?: ComposerKind;
  instruction?: string; // For edit commands
  targetKind?: ComposerKind; // For convert commands
  targetComposerId?: string; // For relate commands
  tags?: string[]; // For tag commands
  shareWith?: string[]; // For share commands
  exportFormat?: 'pdf' | 'markdown' | 'json' | 'csv'; // For export commands
  confidence: number; // 0-1 confidence score
}

/**
 * Result of command detection
 */
export interface CommandDetectionResult {
  hasCommand: boolean;
  commands: ComposerCommand[];
  cleanedMessage: string; // Message with command parts removed
  originalMessage: string;
}

/**
 * Edit intent patterns with their confidence weights
 */
const EDIT_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  // Direct edit commands
  { pattern: /\bedit\b/i, weight: 0.9 },
  { pattern: /\bupdate\b/i, weight: 0.85 },
  { pattern: /\bmodify\b/i, weight: 0.85 },
  { pattern: /\bchange\b/i, weight: 0.8 },
  { pattern: /\brevise\b/i, weight: 0.85 },
  { pattern: /\bfix\b/i, weight: 0.75 },
  
  // Content modification
  { pattern: /\badd\b.*\bto\b/i, weight: 0.85 },
  { pattern: /\bremove\b.*\bfrom\b/i, weight: 0.85 },
  { pattern: /\binsert\b/i, weight: 0.8 },
  { pattern: /\bappend\b/i, weight: 0.8 },
  { pattern: /\bprepend\b/i, weight: 0.8 },
  { pattern: /\breplace\b/i, weight: 0.85 },
  
  // Style modifications
  { pattern: /\bmake\b.*\b(longer|shorter|more|less)\b/i, weight: 0.85 },
  { pattern: /\bexpand\b/i, weight: 0.8 },
  { pattern: /\bcondense\b/i, weight: 0.8 },
  { pattern: /\bshorten\b/i, weight: 0.8 },
  { pattern: /\blengthen\b/i, weight: 0.8 },
  { pattern: /\bsimplify\b/i, weight: 0.75 },
  { pattern: /\belaborate\b/i, weight: 0.75 },
  
  // Quality improvements
  { pattern: /\bimprove\b/i, weight: 0.8 },
  { pattern: /\brewrite\b/i, weight: 0.85 },
  { pattern: /\brephrase\b/i, weight: 0.85 },
  { pattern: /\bpolish\b/i, weight: 0.8 },
  { pattern: /\brefine\b/i, weight: 0.8 },
  { pattern: /\bclarify\b/i, weight: 0.75 },
  { pattern: /\benhance\b/i, weight: 0.75 },
  
  // Format changes
  { pattern: /\bformat\b/i, weight: 0.7 },
  { pattern: /\breformat\b/i, weight: 0.8 },
  { pattern: /\brestructure\b/i, weight: 0.8 },
  { pattern: /\breorganize\b/i, weight: 0.8 },
  
  // Translation/conversion
  { pattern: /\btranslate\b/i, weight: 0.85 },
  { pattern: /\bsummarize\b/i, weight: 0.7 },
];

/**
 * Other command patterns
 */
const OTHER_COMMAND_PATTERNS: Record<ComposerCommandType, RegExp[]> = {
  view: [/\bview\b/i, /\bopen\b/i, /\bshow\b/i, /\bdisplay\b/i, /\bsee\b/i],
  duplicate: [/\bduplicate\b/i, /\bcopy\b/i, /\bclone\b/i, /\breplicate\b/i],
  delete: [/\bdelete\b/i, /\bremove\b/i, /\btrash\b/i, /\bdiscard\b/i],
  share: [/\bshare\b/i, /\bsend\b.*\bto\b/i, /\bgive\b.*\baccess\b/i],
  export: [/\bexport\b/i, /\bdownload\b/i, /\bsave\b.*\bas\b/i],
  tag: [/\btag\b/i, /\blabel\b/i, /\bcategorize\b/i, /\badd\b.*\btag\b/i],
  relate: [/\blink\b.*\bto\b/i, /\bconnect\b.*\bto\b/i, /\brelate\b.*\bto\b/i],
  convert: [/\bconvert\b.*\bto\b/i, /\bturn\b.*\binto\b/i, /\bmake\b.*\ba\b/i],
  edit: [], // Handled separately with weights
};

/**
 * Composer Command Detector
 * 
 * Detects and parses commands for operating on composers from natural language messages.
 */
export class ComposerCommandDetector {
  /**
   * Detect commands from a message with mentions
   */
  static detectCommands(
    message: string,
    mentions: ProcessedMention[],
  ): CommandDetectionResult {
    const result: CommandDetectionResult = {
      hasCommand: false,
      commands: [],
      cleanedMessage: message,
      originalMessage: message,
    };

    // Filter to only composer mentions
    const composerMentions = mentions.filter((m) =>
      m.type.includes('composer') || this.isComposerMentionType(m.type),
    );

    if (composerMentions.length === 0) {
      return result;
    }

    // Check for each type of command
    for (const mention of composerMentions) {
      const composerId = mention.id.replace('composer-', '');
      
      // Check for edit commands first (most common)
      const editResult = this.detectEditCommand(message, mention);
      if (editResult) {
        result.commands.push({
          ...editResult,
          composerId,
          composerTitle: mention.name,
          composerKind: mention.metadata?.kind,
        });
        continue;
      }

      // Check for other commands
      for (const [commandType, patterns] of Object.entries(OTHER_COMMAND_PATTERNS)) {
        if (commandType === 'edit') continue; // Already handled
        
        for (const pattern of patterns) {
          if (pattern.test(message)) {
            const command = this.parseCommand(
              commandType as ComposerCommandType,
              message,
              mention,
            );
            if (command) {
              result.commands.push({
                ...command,
                composerId,
                composerTitle: mention.name,
                composerKind: mention.metadata?.kind,
              });
            }
            break;
          }
        }
      }
    }

    result.hasCommand = result.commands.length > 0;

    // Clean the message by removing command-related parts
    if (result.hasCommand) {
      result.cleanedMessage = this.cleanMessage(message, result.commands);
    }

    return result;
  }

  /**
   * Detect edit command with confidence scoring
   */
  private static detectEditCommand(
    message: string,
    mention: ProcessedMention,
  ): Omit<ComposerCommand, 'composerId' | 'composerTitle' | 'composerKind'> | null {
    let totalWeight = 0;
    let matchCount = 0;

    for (const { pattern, weight } of EDIT_PATTERNS) {
      if (pattern.test(message)) {
        totalWeight += weight;
        matchCount++;
      }
    }

    // No edit patterns matched
    if (matchCount === 0) {
      return null;
    }

    // Calculate confidence (average weight, capped at 1)
    const confidence = Math.min(totalWeight / matchCount, 1);

    // Extract the edit instruction
    const instruction = this.extractEditInstruction(message);

    return {
      type: 'edit',
      instruction,
      confidence,
    };
  }

  /**
   * Parse a specific command type
   */
  private static parseCommand(
    type: ComposerCommandType,
    message: string,
    mention: ProcessedMention,
  ): Omit<ComposerCommand, 'composerId' | 'composerTitle' | 'composerKind'> | null {
    const baseCommand = {
      type,
      confidence: 0.8,
    };

    switch (type) {
      case 'convert': {
        const kindMatch = message.match(
          /convert.*to\s+(text|code|sheet|chart|image|vto|accountability)/i,
        );
        if (kindMatch) {
          return {
            ...baseCommand,
            targetKind: kindMatch[1].toLowerCase() as ComposerKind,
          };
        }
        return null;
      }

      case 'export': {
        const formatMatch = message.match(
          /export.*(?:as|to)\s+(pdf|markdown|md|json|csv)/i,
        );
        const format = formatMatch?.[1]?.toLowerCase();
        return {
          ...baseCommand,
          exportFormat: (format === 'md' ? 'markdown' : format) as ComposerCommand['exportFormat'],
        };
      }

      case 'tag': {
        const tagsMatch = message.match(
          /(?:tag|label|add\s+tag).*?(?:with|as)?\s*["""]?([^"""]+)["""]?/i,
        );
        if (tagsMatch) {
          const tags = tagsMatch[1]
            .split(/[,\s]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          return {
            ...baseCommand,
            tags,
          };
        }
        return baseCommand;
      }

      case 'share': {
        const shareMatch = message.match(
          /share.*(?:with|to)\s+([^.!?]+)/i,
        );
        if (shareMatch) {
          const shareWith = shareMatch[1]
            .split(/[,\s]+and\s+|[,\s]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          return {
            ...baseCommand,
            shareWith,
          };
        }
        return baseCommand;
      }

      case 'relate': {
        // This would need access to other composer mentions
        return baseCommand;
      }

      default:
        return baseCommand;
    }
  }

  /**
   * Extract the edit instruction from a message
   */
  private static extractEditInstruction(message: string): string {
    let instruction = message;

    // Remove mention patterns
    instruction = instruction.replace(/@[\w-]+(?::[\w-]+)?/g, '').trim();

    // Remove common prefixes
    const prefixes = [
      /^please\s+/i,
      /^can\s+you\s+/i,
      /^could\s+you\s+/i,
      /^would\s+you\s+/i,
      /^i\s+want\s+(?:you\s+)?to\s+/i,
      /^i\s+need\s+(?:you\s+)?to\s+/i,
      /^i['']d\s+like\s+(?:you\s+)?to\s+/i,
    ];

    for (const prefix of prefixes) {
      instruction = instruction.replace(prefix, '');
    }

    return instruction.trim();
  }

  /**
   * Clean the message by removing command-related content
   */
  private static cleanMessage(
    message: string,
    commands: ComposerCommand[],
  ): string {
    let cleaned = message;

    // Remove mention patterns
    cleaned = cleaned.replace(/@[\w-]+(?::[\w-]+)?/g, '').trim();

    // Remove command verbs at the start
    const commandVerbs = [
      'edit',
      'update',
      'modify',
      'change',
      'view',
      'open',
      'delete',
      'share',
      'export',
      'convert',
      'duplicate',
    ];
    const verbPattern = new RegExp(
      `^(?:please\\s+)?(?:${commandVerbs.join('|')})\\s+`,
      'i',
    );
    cleaned = cleaned.replace(verbPattern, '');

    return cleaned.trim();
  }

  /**
   * Check if a mention type is a composer type
   */
  private static isComposerMentionType(type: string): boolean {
    const composerTypes = [
      'composer',
      'text-composer',
      'code-composer',
      'sheet-composer',
      'chart-composer',
      'image-composer',
      'vto-composer',
      'accountability-composer',
    ];
    return composerTypes.includes(type);
  }

  /**
   * Get the primary command from detection result
   */
  static getPrimaryCommand(result: CommandDetectionResult): ComposerCommand | null {
    if (!result.hasCommand || result.commands.length === 0) {
      return null;
    }

    // Return the command with highest confidence
    return result.commands.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );
  }

  /**
   * Check if the message likely contains an edit request
   */
  static isLikelyEditRequest(message: string): boolean {
    return EDIT_PATTERNS.some(({ pattern }) => pattern.test(message));
  }

  /**
   * Get all edit commands from a detection result
   */
  static getEditCommands(result: CommandDetectionResult): ComposerCommand[] {
    return result.commands.filter((cmd) => cmd.type === 'edit');
  }
}
