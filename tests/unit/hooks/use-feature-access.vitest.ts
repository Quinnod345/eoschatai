// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the account store
const mockAccountStore = {
  entitlements: null as any,
  user: null as any,
  usageCounters: null as any,
};

vi.mock('@/lib/stores/account-store', () => ({
  useAccountStore: (selector: (state: typeof mockAccountStore) => any) => 
    selector(mockAccountStore),
}));

// Import after mock
import { useFeatureAccess, useComposerTypeAccess } from '@/hooks/use-feature-access';

describe('useFeatureAccess', () => {
  beforeEach(() => {
    // Reset mock state
    mockAccountStore.entitlements = null;
    mockAccountStore.user = null;
    mockAccountStore.usageCounters = null;
  });

  describe('when no entitlements', () => {
    it('returns no access with pro required', () => {
      const { result } = renderHook(() => useFeatureAccess('export'));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('pro');
    });
  });

  describe('simple boolean features', () => {
    it('returns access for enabled feature', () => {
      mockAccountStore.entitlements = {
        features: {
          export: true,
        },
      };

      const { result } = renderHook(() => useFeatureAccess('export'));

      expect(result.current.hasAccess).toBe(true);
      expect(result.current.requiredPlan).toBeUndefined();
    });

    it('returns no access for disabled feature', () => {
      mockAccountStore.entitlements = {
        features: {
          export: false,
        },
      };

      const { result } = renderHook(() => useFeatureAccess('export'));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('pro');
    });

    it('handles calendar_connect feature', () => {
      mockAccountStore.entitlements = {
        features: {
          calendar_connect: true,
        },
      };

      const { result } = renderHook(() => useFeatureAccess('calendar_connect'));

      expect(result.current.hasAccess).toBe(true);
    });
  });

  describe('nested features', () => {
    it('handles recordings.transcription', () => {
      mockAccountStore.entitlements = {
        features: {
          recordings: {
            enabled: true,
            transcription: true,
            speaker_diarization: false,
            ai_summaries: false,
            minutes_month: 100,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('recordings.transcription'));

      expect(result.current.hasAccess).toBe(true);
    });

    it('handles recordings.speaker_diarization disabled', () => {
      mockAccountStore.entitlements = {
        features: {
          recordings: {
            enabled: true,
            transcription: true,
            speaker_diarization: false,
            ai_summaries: false,
            minutes_month: 100,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('recordings.speaker_diarization'));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('pro');
    });

    it('handles memory.embeddings', () => {
      mockAccountStore.entitlements = {
        features: {
          memory: {
            enabled: true,
            embeddings: true,
            max_memories: 100,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('memory.embeddings'));

      expect(result.current.hasAccess).toBe(true);
    });
  });

  describe('recordings feature (special case)', () => {
    it('returns usage info for recordings', () => {
      mockAccountStore.entitlements = {
        features: {
          recordings: {
            enabled: true,
            minutes_month: 60,
            transcription: true,
            speaker_diarization: false,
            ai_summaries: false,
          },
        },
      };
      mockAccountStore.usageCounters = {
        asr_minutes_month: 25,
      };

      const { result } = renderHook(() => useFeatureAccess('recordings'));

      expect(result.current.hasAccess).toBe(true);
      expect(result.current.limit).toBe(60);
      expect(result.current.used).toBe(25);
      expect(result.current.remaining).toBe(35);
    });

    it('returns no access when recordings disabled', () => {
      mockAccountStore.entitlements = {
        features: {
          recordings: {
            enabled: false,
            minutes_month: 0,
            transcription: false,
            speaker_diarization: false,
            ai_summaries: false,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('recordings'));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('pro');
    });
  });

  describe('deep_research feature', () => {
    it('returns access with limit', () => {
      mockAccountStore.entitlements = {
        features: {
          deep_research: {
            enabled: true,
            lookups_per_run: 15,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('deep_research'));

      expect(result.current.hasAccess).toBe(true);
      expect(result.current.limit).toBe(15);
    });

    it('requires business plan when disabled', () => {
      mockAccountStore.entitlements = {
        features: {
          deep_research: {
            enabled: false,
            lookups_per_run: 0,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('deep_research'));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('business');
    });
  });

  describe('personas.custom feature', () => {
    it('returns access for custom personas enabled', () => {
      mockAccountStore.entitlements = {
        features: {
          personas: {
            custom: true,
            shared: true,
            max_count: 10,
          },
        },
      };
      mockAccountStore.usageCounters = {
        personas_created: 3,
      };

      const { result } = renderHook(() => useFeatureAccess('personas.custom'));

      // personas.custom is a nested boolean check, returns access but special case
      // adds limit/used/remaining
      expect(result.current.hasAccess).toBe(true);
      // The special case in the switch handles this
      expect(result.current.requiredPlan).toBeUndefined();
    });

    it('returns no access when custom personas disabled', () => {
      mockAccountStore.entitlements = {
        features: {
          personas: {
            custom: false,
            shared: false,
            max_count: 0,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('personas.custom'));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('pro');
    });
  });

  describe('memory feature', () => {
    it('returns usage info', () => {
      mockAccountStore.entitlements = {
        features: {
          memory: {
            enabled: true,
            max_memories: 500,
            embeddings: true,
          },
        },
      };
      mockAccountStore.usageCounters = {
        memories_stored: 123,
      };

      const { result } = renderHook(() => useFeatureAccess('memory'));

      expect(result.current.hasAccess).toBe(true);
      expect(result.current.limit).toBe(500);
      expect(result.current.used).toBe(123);
      expect(result.current.remaining).toBe(377);
    });

    it('handles unlimited memories (-1)', () => {
      mockAccountStore.entitlements = {
        features: {
          memory: {
            enabled: true,
            max_memories: -1,
            embeddings: true,
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('memory'));

      expect(result.current.limit).toBe(Number.POSITIVE_INFINITY);
      expect(result.current.remaining).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('composer.advanced feature', () => {
    it('returns access when enabled', () => {
      mockAccountStore.entitlements = {
        features: {
          composer: {
            advanced: true,
            types: ['text', 'code', 'chart'],
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('composer.advanced'));

      expect(result.current.hasAccess).toBe(true);
      expect(result.current.requiredPlan).toBeUndefined();
    });

    it('requires pro when disabled', () => {
      mockAccountStore.entitlements = {
        features: {
          composer: {
            advanced: false,
            types: ['text'],
          },
        },
      };

      const { result } = renderHook(() => useFeatureAccess('composer.advanced'));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('pro');
    });
  });

  describe('showUpgradeModal', () => {
    it('returns a callable function', () => {
      mockAccountStore.entitlements = {
        features: {
          export: false,
        },
      };

      const { result } = renderHook(() => useFeatureAccess('export'));

      expect(typeof result.current.showUpgradeModal).toBe('function');
      
      // Should not throw
      act(() => {
        result.current.showUpgradeModal();
      });
    });
  });

  describe('unknown features', () => {
    it('returns no access for unknown feature', () => {
      mockAccountStore.entitlements = {
        features: {},
      };

      const { result } = renderHook(() => useFeatureAccess('unknown_feature' as any));

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredPlan).toBe('pro');
    });
  });
});

describe('useComposerTypeAccess', () => {
  beforeEach(() => {
    mockAccountStore.entitlements = null;
  });

  it('returns no access when no entitlements', () => {
    const { result } = renderHook(() => useComposerTypeAccess('code'));

    expect(result.current.hasAccess).toBe(false);
  });

  it('returns access for included type', () => {
    mockAccountStore.entitlements = {
      features: {
        composer: {
          types: ['text', 'code', 'chart'],
        },
      },
    };

    const { result } = renderHook(() => useComposerTypeAccess('code'));

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.requiredPlan).toBeUndefined();
  });

  it('returns no access for excluded type', () => {
    mockAccountStore.entitlements = {
      features: {
        composer: {
          types: ['text'],
        },
      },
    };

    const { result } = renderHook(() => useComposerTypeAccess('chart'));

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.requiredPlan).toBe('pro');
  });

  it('text type does not require pro plan', () => {
    mockAccountStore.entitlements = {
      features: {
        composer: {
          types: [],
        },
      },
    };

    const { result } = renderHook(() => useComposerTypeAccess('text'));

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.requiredPlan).toBeUndefined();
  });
});
