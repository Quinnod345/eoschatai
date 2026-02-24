// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { SmartMentionDetector } from '@/lib/ai/smart-mention-detector';

describe('SmartMentionDetector', () => {
  describe('detectImplicitMentions', () => {
    it('should detect calendar mentions', () => {
      const testCases = [
        'What do I have on my calendar today?',
        'Any meetings tomorrow?', 
        'What events are scheduled this week?',
        'Check my schedule for next week',
      ];

      testCases.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const calendarMention = mentions.find(m => m.type === 'calendar');
        
        expect(calendarMention).toBeDefined();
        expect(calendarMention?.confidence).toBeGreaterThan(0.6);
        expect(calendarMention?.context).toBe('User is discussing calendar/scheduling');
      });
    });

    it('should detect availability mentions', () => {
      const testCases = [
        'When can we schedule a meeting?',
        'Find time for a call this week',
        'Are you available for lunch tomorrow?',
      ];

      testCases.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const availabilityMention = mentions.find(m => m.type === 'availability');
        
        expect(availabilityMention).toBeDefined();
        expect(availabilityMention?.confidence).toBeGreaterThan(0.6);
        expect(availabilityMention?.context).toBe('User wants to find free time');
      });
    });

    it('should detect analysis mentions', () => {
      const testCases = [
        'Analyze the sales data from last month',
        'Show me insights on user behavior',
        'How many users signed up this quarter?',
      ];

      testCases.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const analysisMention = mentions.find(m => m.type === 'analyze');
        
        expect(analysisMention).toBeDefined();
        expect(analysisMention?.confidence).toBeGreaterThan(0.6);
        expect(analysisMention?.context).toBe('User wants data analysis');
      });
    });

    it('should detect document mentions', () => {
      const testCases = [
        'Show me my uploaded documents',
        'Find the contract from last week',
        'Review the PDF I shared',
      ];

      testCases.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const documentMention = mentions.find(m => m.type === 'document');
        
        expect(documentMention).toBeDefined();
        expect(documentMention?.confidence).toBeGreaterThan(0.6);
        expect(documentMention?.context).toBe('User is asking about documents');
      });
    });

    it('should detect scorecard mentions', () => {
      const testCases = [
        'How are our EOS metrics looking?',
        'Check the weekly scorecard numbers',
        'What are our KPIs for this quarter?',
      ];

      testCases.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        const scorecardMention = mentions.find(m => m.type === 'scorecard');
        
        expect(scorecardMention).toBeDefined();
        expect(scorecardMention?.confidence).toBeGreaterThan(0.6);
        expect(scorecardMention?.context).toBe('User is asking about EOS Scorecard');
      });
    });

    it('should filter out low-confidence mentions', () => {
      const lowConfidenceMessage = 'Just saying hello';
      const mentions = SmartMentionDetector.detectImplicitMentions(lowConfidenceMessage);
      
      expect(mentions).toHaveLength(0);
    });

    it('should handle empty messages', () => {
      expect(SmartMentionDetector.detectImplicitMentions('')).toHaveLength(0);
      expect(SmartMentionDetector.detectImplicitMentions('   ')).toHaveLength(0);
    });

    it('should extract appropriate triggers', () => {
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

  describe('Confidence scoring', () => {
    it('should assign higher confidence to more specific calendar queries', () => {
      const specificMessage = 'What\'s on my calendar today?';
      const generalMessage = 'Maybe we should schedule something';
      
      const specificMentions = SmartMentionDetector.detectImplicitMentions(specificMessage);
      const generalMentions = SmartMentionDetector.detectImplicitMentions(generalMessage);
      
      const specificCalendar = specificMentions.find(m => m.type === 'calendar');
      const generalCalendar = generalMentions.find(m => m.type === 'calendar');
      
      if (specificCalendar && generalCalendar) {
        expect(specificCalendar.confidence).toBeGreaterThan(generalCalendar.confidence);
      }
    });

    it('should ensure all returned mentions meet minimum confidence threshold', () => {
      const messages = [
        'What meetings do I have today?',
        'Find free time for lunch',
        'Analyze the sales data',
        'Show me my documents',
        'Check the EOS scorecard metrics',
      ];

      messages.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        mentions.forEach(mention => {
          expect(mention.confidence).toBeGreaterThan(0.6);
        });
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle mixed case input', () => {
      const message = 'WHAT MEETINGS DO I HAVE TODAY?';
      const mentions = SmartMentionDetector.detectImplicitMentions(message);
      
      expect(mentions.length).toBeGreaterThan(0);
    });

    it('should handle punctuation variations', () => {
      const messages = [
        'What meetings today?',
        'What meetings today!',
        'What meetings, today?',
      ];

      messages.forEach(message => {
        const mentions = SmartMentionDetector.detectImplicitMentions(message);
        expect(mentions.some(m => m.type === 'calendar')).toBe(true);
      });
    });

    it('should handle multiple intent types in one message', () => {
      const message = 'Check my calendar for meetings and analyze the attendance data';
      const mentions = SmartMentionDetector.detectImplicitMentions(message);
      
      const types = mentions.map(m => m.type);
      expect(types.includes('calendar')).toBe(true);
      expect(types.includes('analyze')).toBe(true);
    });
  });
});