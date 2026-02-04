import { describe, it, expect } from 'vitest';
import { SmartMentionDetector } from '@/lib/ai/smart-mention-detector';

describe('SmartMentionDetector', () => {
  describe('detectImplicitMentions', () => {
    it('should detect calendar mentions', () => {
      const messages = [
        'What do I have on my calendar today?',
        'Any meetings tomorrow?',
        'What events are scheduled this week?',
        'Check my schedule for next week',
      ];

      messages.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const calendarMention = mentions.find(m => m.type === 'calendar');
        expect(calendarMention).toBeDefined();
        expect(calendarMention!.confidence).toBeGreaterThan(0.6);
        expect(calendarMention!.context).toBe('User is discussing calendar/scheduling');
      });
    });

    it('should detect availability mentions', () => {
      const messages = [
        'When can we schedule a meeting?',
        'Find time for a call this week',
        'Are you available for lunch tomorrow?',
        'Book a 30-minute slot for coffee',
      ];

      messages.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const availabilityMention = mentions.find(m => m.type === 'availability');
        expect(availabilityMention).toBeDefined();
        expect(availabilityMention!.confidence).toBeGreaterThan(0.6);
        expect(availabilityMention!.context).toBe('User wants to find free time');
      });
    });

    it('should detect analysis mentions', () => {
      const messages = [
        'Analyze the sales data from last month',
        'Show me insights on user behavior',
        'How many users signed up this quarter?',
        'What are the performance metrics?',
      ];

      messages.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const analysisMention = mentions.find(m => m.type === 'analyze');
        expect(analysisMention).toBeDefined();
        expect(analysisMention!.confidence).toBeGreaterThan(0.6);
        expect(analysisMention!.context).toBe('User wants data analysis');
      });
    });

    it('should detect document mentions', () => {
      const messages = [
        'Show me my uploaded documents',
        'Find the contract from last week',
        'Review the PDF I shared',
        'Look up that report file',
      ];

      messages.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const documentMention = mentions.find(m => m.type === 'document');
        expect(documentMention).toBeDefined();
        expect(documentMention!.confidence).toBeGreaterThan(0.6);
        expect(documentMention!.context).toBe('User is asking about documents');
      });
    });

    it('should detect scorecard mentions', () => {
      const messages = [
        'How are our EOS metrics looking?',
        'Check the weekly scorecard numbers',
        'What are our KPIs for this quarter?',
        'Review the measurables performance',
      ];

      messages.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const scorecardMention = mentions.find(m => m.type === 'scorecard');
        expect(scorecardMention).toBeDefined();
        expect(scorecardMention!.confidence).toBeGreaterThan(0.6);
        expect(scorecardMention!.context).toBe('User is asking about EOS Scorecard');
      });
    });

    it('should filter out low-confidence mentions', () => {
      const lowConfidenceMessage = 'Just saying hello';
      const mentions = SmartMentionDetector.detectImplicitMentions(lowConfidenceMessage);
      expect(mentions).toHaveLength(0);
    });

    it('should handle empty or undefined messages', () => {
      expect(SmartMentionDetector.detectImplicitMentions('')).toHaveLength(0);
      expect(SmartMentionDetector.detectImplicitMentions('   ')).toHaveLength(0);
    });

    it('should extract correct triggers', () => {
      const message = 'What meetings do I have today?';
      const mentions = SmartMentionDetector.detectImplicitMentions(message);
      const calendarMention = mentions.find(m => m.type === 'calendar');
      expect(calendarMention?.trigger).toMatch(/meeting|today/);
    });
  });

  describe('generateSmartSuggestions', () => {
    it('should suggest calendar mentions for calendar intents', () => {
      const message = 'What do I have scheduled today?';
      const suggestions = SmartMentionDetector.generateSmartSuggestions(message);
      expect(suggestions.some(s => s.includes('@cal'))).toBe(true);
    });

    it('should suggest availability mentions for free time queries', () => {
      const message = 'When am I free this week?';
      const suggestions = SmartMentionDetector.generateSmartSuggestions(message);
      expect(suggestions.some(s => s.includes('@free'))).toBe(true);
    });

    it('should suggest analysis mentions for analysis intents', () => {
      const message = 'Analyze our quarterly performance';
      const suggestions = SmartMentionDetector.generateSmartSuggestions(message);
      expect(suggestions.some(s => s.includes('@analyze'))).toBe(true);
    });

    it('should suggest document mentions for document intents', () => {
      const message = 'Find my uploaded files';
      const suggestions = SmartMentionDetector.generateSmartSuggestions(message);
      expect(suggestions.some(s => s.includes('@doc'))).toBe(true);
    });

    it('should not suggest mentions if @ is already present', () => {
      const message = 'What do I have @cal today?';
      const suggestions = SmartMentionDetector.generateSmartSuggestions(message);
      expect(suggestions.some(s => s.includes('@cal'))).toBe(false);
    });

    it('should return empty array for non-triggering messages', () => {
      const message = 'Just chatting about the weather';
      const suggestions = SmartMentionDetector.generateSmartSuggestions(message);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('shouldSuggestMentions', () => {
    it('should return true for messages with implicit mentions and no @ symbols', () => {
      const message = 'What meetings do I have today?';
      expect(SmartMentionDetector.shouldSuggestMentions(message)).toBe(true);
    });

    it('should return false for messages already containing @ mentions', () => {
      const message = 'What meetings do I have @cal today?';
      expect(SmartMentionDetector.shouldSuggestMentions(message)).toBe(false);
    });

    it('should return false for messages without implicit mentions', () => {
      const message = 'Hello there!';
      expect(SmartMentionDetector.shouldSuggestMentions(message)).toBe(false);
    });
  });
});