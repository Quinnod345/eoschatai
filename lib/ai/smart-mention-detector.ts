import type { MentionType } from '@/lib/mentions/types';

interface DetectedMention {
  type: MentionType;
  confidence: number;
  trigger: string;
  context: string;
}

export class SmartMentionDetector {
  // Detect implicit mentions from natural language
  static detectImplicitMentions(message: string): DetectedMention[] {
    const detectedMentions: DetectedMention[] = [];
    const lowerMessage = message.toLowerCase();

    // Calendar-related detection
    if (SmartMentionDetector.hasCalendarIntent(lowerMessage)) {
      detectedMentions.push({
        type: 'calendar',
        confidence: SmartMentionDetector.getCalendarConfidence(lowerMessage),
        trigger: SmartMentionDetector.extractCalendarTrigger(lowerMessage),
        context: 'User is discussing calendar/scheduling',
      });
    }

    // Availability detection
    if (SmartMentionDetector.hasAvailabilityIntent(lowerMessage)) {
      detectedMentions.push({
        type: 'availability',
        confidence:
          SmartMentionDetector.getAvailabilityConfidence(lowerMessage),
        trigger: SmartMentionDetector.extractAvailabilityTrigger(lowerMessage),
        context: 'User wants to find free time',
      });
    }

    // Analysis detection
    if (SmartMentionDetector.hasAnalysisIntent(lowerMessage)) {
      detectedMentions.push({
        type: 'analyze',
        confidence: SmartMentionDetector.getAnalysisConfidence(lowerMessage),
        trigger: SmartMentionDetector.extractAnalysisTrigger(lowerMessage),
        context: 'User wants data analysis',
      });
    }

    // Document detection
    if (SmartMentionDetector.hasDocumentIntent(lowerMessage)) {
      detectedMentions.push({
        type: 'document',
        confidence: SmartMentionDetector.getDocumentConfidence(lowerMessage),
        trigger: SmartMentionDetector.extractDocumentTrigger(lowerMessage),
        context: 'User is asking about documents',
      });
    }

    // EOS-specific detections
    if (SmartMentionDetector.hasScorecardIntent(lowerMessage)) {
      detectedMentions.push({
        type: 'scorecard',
        confidence: SmartMentionDetector.getScorecardConfidence(lowerMessage),
        trigger: SmartMentionDetector.extractScorecardTrigger(lowerMessage),
        context: 'User is asking about EOS Scorecard',
      });
    }

    return detectedMentions.filter((m) => m.confidence > 0.6); // Only high-confidence mentions
  }

  // Calendar intent detection
  private static hasCalendarIntent(message: string): boolean {
    return /\b(schedule|calendar|meeting|appointment|event|today|tomorrow|this week|next week)\b/.test(
      message,
    );
  }

  private static getCalendarConfidence(message: string): number {
    let confidence = 0;
    if (/\b(my schedule|my calendar|what's on|do I have)\b/.test(message))
      confidence += 0.4;
    if (/\b(today|tomorrow|this week|next week)\b/.test(message))
      confidence += 0.3;
    if (/\b(meeting|appointment|event)\b/.test(message)) confidence += 0.3;
    if (/\?(.*)(schedule|calendar|meeting)/.test(message)) confidence += 0.2;
    return Math.min(confidence, 1.0);
  }

  private static extractCalendarTrigger(message: string): string {
    const triggers = message.match(
      /\b(schedule|calendar|meeting|appointment|event|today|tomorrow|this week|next week)\b/,
    );
    return triggers ? triggers[0] : 'calendar';
  }

  // Availability intent detection
  private static hasAvailabilityIntent(message: string): boolean {
    return (
      /\b(free time|available|when can|find time|schedule|book|slot)\b/.test(
        message,
      ) && /\b(meeting|call|time|lunch|coffee)\b/.test(message)
    );
  }

  private static getAvailabilityConfidence(message: string): number {
    let confidence = 0;
    if (
      /\b(when can|when are you free|find time|available time)\b/.test(message)
    )
      confidence += 0.5;
    if (/\b(schedule|book|set up)\b/.test(message)) confidence += 0.3;
    if (/\b(meeting|call|lunch|coffee)\b/.test(message)) confidence += 0.2;
    if (/\b(minutes?|hours?|duration)\b/.test(message)) confidence += 0.2;
    return Math.min(confidence, 1.0);
  }

  private static extractAvailabilityTrigger(message: string): string {
    const triggers = message.match(
      /\b(free time|available|when can|find time|schedule|book)\b/,
    );
    return triggers ? triggers[0] : 'available';
  }

  // Analysis intent detection
  private static hasAnalysisIntent(message: string): boolean {
    return /\b(analyze|analysis|insights|report|metrics|data|trends|performance|how many|statistics)\b/.test(
      message,
    );
  }

  private static getAnalysisConfidence(message: string): number {
    let confidence = 0;
    if (/\b(analyze|analysis|insights)\b/.test(message)) confidence += 0.4;
    if (/\b(how many|how much|statistics|metrics)\b/.test(message))
      confidence += 0.3;
    if (/\b(last week|last month|this quarter|trend)\b/.test(message))
      confidence += 0.3;
    return Math.min(confidence, 1.0);
  }

  private static extractAnalysisTrigger(message: string): string {
    const triggers = message.match(
      /\b(analyze|analysis|insights|report|metrics|how many)\b/,
    );
    return triggers ? triggers[0] : 'analyze';
  }

  // Document intent detection
  private static hasDocumentIntent(message: string): boolean {
    return (
      /\b(document|file|doc|paper|report|pdf|upload)\b/.test(message) ||
      (/\b(show me|find|look up|review)\b/.test(message) &&
        /\b(document|file)\b/.test(message))
    );
  }

  private static getDocumentConfidence(message: string): number {
    let confidence = 0;
    if (/\b(my documents?|my files?|uploaded)\b/.test(message))
      confidence += 0.4;
    if (/\b(show me|find|look up|review)\b/.test(message)) confidence += 0.2;
    if (/\b(document|file|doc|paper|report)\b/.test(message)) confidence += 0.3;
    return Math.min(confidence, 1.0);
  }

  private static extractDocumentTrigger(message: string): string {
    const triggers = message.match(
      /\b(document|file|doc|paper|report|show me|find)\b/,
    );
    return triggers ? triggers[0] : 'document';
  }

  // Scorecard intent detection
  private static hasScorecardIntent(message: string): boolean {
    return (
      /\b(scorecard|metrics|kpis?|measurables?|numbers?|performance|goals?)\b/.test(
        message,
      ) &&
      (/\b(eos|weekly|review|check|how are we)\b/.test(message) ||
        message.includes('?'))
    );
  }

  private static getScorecardConfidence(message: string): number {
    let confidence = 0;
    if (/\b(scorecard|measurables?)\b/.test(message)) confidence += 0.5;
    if (/\b(metrics|kpis?|numbers?)\b/.test(message)) confidence += 0.3;
    if (/\b(weekly|performance|how are we)\b/.test(message)) confidence += 0.2;
    return Math.min(confidence, 1.0);
  }

  private static extractScorecardTrigger(message: string): string {
    const triggers = message.match(
      /\b(scorecard|metrics|kpis?|measurables?|performance)\b/,
    );
    return triggers ? triggers[0] : 'scorecard';
  }

  // Generate smart suggestions based on detected intents
  static generateSmartSuggestions(message: string): string[] {
    const suggestions: string[] = [];
    const lowerMessage = message.toLowerCase();

    // Calendar suggestions
    if (SmartMentionDetector.hasCalendarIntent(lowerMessage)) {
      if (!message.includes('@')) {
        suggestions.push('💡 Tip: Use @cal to quickly access your calendar');
      }
      if (/\b(free|available)\b/.test(lowerMessage)) {
        suggestions.push('💡 Try: @free to find available time slots');
      }
    }

    // Analysis suggestions
    if (SmartMentionDetector.hasAnalysisIntent(lowerMessage)) {
      if (!message.includes('@')) {
        suggestions.push('💡 Tip: Use @analyze for detailed insights');
      }
    }

    // Document suggestions
    if (SmartMentionDetector.hasDocumentIntent(lowerMessage)) {
      if (!message.includes('@')) {
        suggestions.push('💡 Tip: Use @doc to search your documents');
      }
    }

    return suggestions;
  }

  // Check if message would benefit from explicit mentions
  static shouldSuggestMentions(message: string): boolean {
    const implicitMentions =
      SmartMentionDetector.detectImplicitMentions(message);
    return implicitMentions.length > 0 && !message.includes('@');
  }
}
