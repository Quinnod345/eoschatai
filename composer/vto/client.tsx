'use client';

import { Composer } from '@/components/create-composer';
import { ComposerEditingOverlay } from '@/components/composer-editing-overlay';
import {
  CopyIcon,
  DownloadIcon,
  RedoIcon,
  UndoIcon,
  InfoIcon,
} from '@/components/icons';
import { toast } from '@/lib/toast-system';
import React, { useEffect, useMemo, useRef, useCallback, memo, useState } from 'react';
import { useComposer as useGlobalComposer } from '@/hooks/use-composer';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Data model for a Vision/Traction Organizer (V/TO)
export interface VtoRock {
  title: string;
  metric: string;
  owner: string;
  dueDate: string;
}

export interface VtoData {
  coreValues: string[];
  coreFocus: { purpose: string; niche: string };
  tenYearTarget: string;
  marketingStrategy: {
    targetMarket: string;
    threeUniques: string[];
    provenProcess: string;
    guarantee: string;
  };
  threeYearPicture: {
    futureDate: string;
    revenue: string;
    profit: string;
    bullets: string[];
  };
  oneYearPlan: {
    futureDate: string;
    revenue: string;
    profit: string;
    goals: string[];
  };
  rocks: {
    futureDate: string;
    revenue?: string;
    profit?: string;
    rocks: Array<string | VtoRock>;
  };
  issuesList: string[];
}

type Metadata = {
  vto: VtoData | null;
};

function defaultVto(): VtoData {
  return {
    coreValues: ['', '', ''],
    coreFocus: { purpose: '', niche: '' },
    tenYearTarget: '',
    marketingStrategy: {
      targetMarket: '',
      threeUniques: ['', '', ''],
      provenProcess: '',
      guarantee: '',
    },
    threeYearPicture: {
      futureDate: '',
      revenue: '',
      profit: '',
      bullets: ['', '', '', '', '', '', '', ''],
    },
    oneYearPlan: {
      futureDate: '',
      revenue: '',
      profit: '',
      goals: ['', '', '', '', ''],
    },
    rocks: {
      futureDate: '',
      revenue: '',
      profit: '',
      rocks: ['', '', '', '', ''],
    },
    issuesList: ['', '', '', '', ''],
  };
}

function parseVtoFromContent(content: string | undefined): VtoData | null {
  if (!content) return null;
  try {
    const hasBegin = content.includes('VTO_DATA_BEGIN');
    const hasEnd = content.includes('VTO_DATA_END');
    let jsonStr = content;
    if (hasBegin && hasEnd) {
      const start = content.indexOf('VTO_DATA_BEGIN') + 'VTO_DATA_BEGIN'.length;
      const end = content.indexOf('VTO_DATA_END');
      jsonStr = content.substring(start, end).trim();
    }
    const parsed = JSON.parse(jsonStr) as Partial<VtoData>;
    // During streaming, parsed object may be incomplete - merge with defaults
    const defaults = defaultVto();
    // Deep merge to ensure all nested objects exist
    const merged: VtoData = {
      coreValues: parsed.coreValues ?? defaults.coreValues,
      coreFocus: {
        ...defaults.coreFocus,
        ...(parsed.coreFocus || {}),
      },
      tenYearTarget: parsed.tenYearTarget ?? defaults.tenYearTarget,
      marketingStrategy: {
        ...defaults.marketingStrategy,
        ...(parsed.marketingStrategy || {}),
      },
      threeYearPicture: {
        ...defaults.threeYearPicture,
        ...(parsed.threeYearPicture || {}),
      },
      oneYearPlan: {
        ...defaults.oneYearPlan,
        ...(parsed.oneYearPlan || {}),
      },
      rocks: {
        ...defaults.rocks,
        ...(parsed.rocks || {}),
      },
      issuesList: parsed.issuesList ?? defaults.issuesList,
    };
    return merged;
  } catch {
    return null;
  }
}

function isNonEmpty(val: any): boolean {
  if (val == null) return false;
  if (typeof val === 'object' && typeof (val as any).title === 'string') {
    return ((val as any).title as string).trim().length > 0;
  }
  const str = String(val);
  return str.trim().length > 0;
}

function isMeaningfulVto(vto: VtoData | null | undefined): boolean {
  if (!vto) return false;
  const hasCoreValues = Array.isArray(vto.coreValues)
    ? vto.coreValues.some(isNonEmpty)
    : false;
  const hasCoreFocus =
    isNonEmpty(vto.coreFocus?.purpose) || isNonEmpty(vto.coreFocus?.niche);
  const hasTenYear = isNonEmpty(vto.tenYearTarget);
  const ms = vto.marketingStrategy;
  const hasMarketing =
    isNonEmpty(ms?.targetMarket) ||
    (Array.isArray(ms?.threeUniques) &&
      (ms?.threeUniques ?? []).some(isNonEmpty)) ||
    isNonEmpty(ms?.provenProcess) ||
    isNonEmpty(ms?.guarantee);
  const typ = vto.threeYearPicture;
  const hasThreeYear =
    isNonEmpty(typ?.futureDate) ||
    isNonEmpty(typ?.revenue) ||
    isNonEmpty(typ?.profit) ||
    (Array.isArray(typ?.bullets) && (typ?.bullets ?? []).some(isNonEmpty));
  const oyp = vto.oneYearPlan;
  const hasOneYear =
    isNonEmpty(oyp?.futureDate) ||
    isNonEmpty(oyp?.revenue) ||
    isNonEmpty(oyp?.profit) ||
    (Array.isArray(oyp?.goals) && (oyp?.goals ?? []).some(isNonEmpty));
  const rocks = vto.rocks;
  const hasRocks =
    isNonEmpty(rocks?.futureDate) ||
    (Array.isArray(rocks?.rocks) && (rocks?.rocks ?? []).some(isNonEmpty));
  const hasIssues = Array.isArray(vto.issuesList)
    ? vto.issuesList.some(isNonEmpty)
    : false;

  return (
    hasCoreValues ||
    hasCoreFocus ||
    hasTenYear ||
    hasMarketing ||
    hasThreeYear ||
    hasOneYear ||
    hasRocks ||
    hasIssues
  );
}

function VtoSectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-slate-700 text-white px-4 py-3 rounded-t-lg text-sm font-semibold tracking-wide">
      {title}
    </div>
  );
}

function LabeledText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-semibold text-[13px]">{label}</div>
      <input
        className="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 break-words whitespace-pre-wrap"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// Individual input row with local state to prevent focus loss
const BulletedListItem = memo(function BulletedListItem({
  value,
  index,
  onChangeValue,
  onRemove,
}: {
  value: string;
  index: number;
  onChangeValue: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Sync local state when prop changes (but not from our own typing)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm text-muted-foreground w-4">{index + 1}.</div>
      <input
        ref={inputRef}
        className="flex-1 border rounded-md px-3 py-2 text-sm dark:bg-zinc-900"
        value={localValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setLocalValue(newValue);
          onChangeValue(index, newValue);
        }}
      />
      <button
        type="button"
        className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={() => onRemove(index)}
      >
        Remove
      </button>
    </div>
  );
});

function BulletedList({
  items,
  onChange,
  addLabel,
}: {
  items: Array<string | any>;
  onChange: (items: string[]) => void;
  addLabel?: string;
}) {
  const handleChangeValue = useCallback((index: number, value: string) => {
    onChange(items.map((it, i) => {
      if (i === index) return value;
      return typeof it === 'string' ? it : (it?.title as string) || '';
    }));
  }, [items, onChange]);

  const handleRemove = useCallback((index: number) => {
    onChange(
      items
        .filter((_, i) => i !== index)
        .map((it) => typeof it === 'string' ? it : (it?.title as string) || ''),
    );
  }, [items, onChange]);

  const handleAdd = useCallback(() => {
    onChange(
      items
        .map((it) => typeof it === 'string' ? it : (it?.title as string) || '')
        .concat(''),
    );
  }, [items, onChange]);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, idx) => {
        const valueStr =
          typeof item === 'string'
            ? item
            : typeof item === 'number'
              ? String(item)
              : (item?.title as string) || '';
        return (
          <BulletedListItem
            key={`item-${idx}`}
            value={valueStr}
            index={idx}
            onChangeValue={handleChangeValue}
            onRemove={handleRemove}
          />
        );
      })}
      <div>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={handleAdd}
        >
          {addLabel ?? 'Add row'}
        </button>
      </div>
    </div>
  );
}

function SmartBadge({ valid }: { valid: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${
        valid
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300'
          : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300'
      }`}
    >
      {valid ? 'SMART ✓' : 'Needs SMART'}
    </span>
  );
}

function quarterEndForLabel(label: string | undefined): string | null {
  if (!label) return null;
  const m = /Q(1|2|3|4)\s*(20\d\d)/i.exec(label.trim());
  if (!m) return null;
  const q = Number(m[1]);
  const year = Number(m[2]);
  const month = q * 3; // 3,6,9,12
  const lastDay = new Date(year, month, 0).getDate();
  const date = new Date(year, month - 1, lastDay);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type SmartCheck = {
  hasTitle: boolean;
  hasMetric: boolean;
  hasOwner: boolean;
  hasDue: boolean;
};

function smartCheck(rock: string | VtoRock, futureDate?: string): SmartCheck {
  if (typeof rock === 'string') {
    const text = rock.trim();
    const hasTitle = text.length > 0;
    const hasMetric =
      /(\d+%?|increase|reduce|launch|ship|hire|close|MQL|SQL|ARR|MRR|leads|users|NPS|tickets|onboard|deploy|publish)/i.test(
        text,
      );
    const hasOwner =
      /\b(by|owner:|@|\b[A-Z][a-z]+\s[A-Z][a-z]+\b|\bCTO\b|\bCEO\b|\bCOO\b|\bHead of\b)/.test(
        text,
      );
    const hasDue =
      /(by\s+\w+\s+\d{1,2},\s*\d{4}|Q[1-4]\s*20\d\d|\b\d{4}-\d{2}-\d{2}\b|\bDec(?:ember)?\b|\bNov(?:ember)?\b|\bOct(?:ober)?\b|\bSep(?:tember)?\b|\bAug(?:ust)?\b|\bJul(?:y)?\b|\bJun(?:e)?\b|\bMay\b|\bApr(?:il)?\b|\bMar(?:ch)?\b|\bFeb(?:ruary)?\b|\bJan(?:uary)?\b)/i.test(
        text,
      );
    return { hasTitle, hasMetric, hasOwner, hasDue };
  }
  const hasTitle = !!rock.title?.trim();
  const hasMetric = !!rock.metric?.trim();
  const hasOwner = !!rock.owner?.trim();
  const hasDue = !!rock.dueDate?.trim() || !!quarterEndForLabel(futureDate);
  return { hasTitle, hasMetric, hasOwner, hasDue };
}

function toSmartRock(rock: string | VtoRock, futureDate?: string): VtoRock {
  if (typeof rock !== 'string') {
    const due = rock.dueDate?.trim() || quarterEndForLabel(futureDate) || '';
    return {
      title: rock.title || '',
      metric: rock.metric || '',
      owner: rock.owner || '',
      dueDate: due,
    };
  }
  const title = rock.trim();
  const due = quarterEndForLabel(futureDate) || '';
  // Heuristic metric suggestion
  let metric = '';
  if (/hire/i.test(title)) metric = 'Hires completed';
  else if (/launch|ship|release/i.test(title))
    metric = 'Launched to production';
  else if (/campaign/i.test(title)) metric = 'Campaign live across 3 channels';
  else if (/revenue|ARR|MRR/i.test(title)) metric = 'Target reached';
  else if (/process|SOP/i.test(title)) metric = 'Documented and approved';
  const owner = '';
  return { title, metric, owner, dueDate: due };
}

// SmartRockRow with local state to prevent focus loss
const SmartRockRow = memo(function SmartRockRow({
  value,
  onChange,
  futureDate,
  onRemove,
}: {
  value: string | VtoRock;
  onChange: (next: string | VtoRock) => void;
  futureDate?: string;
  onRemove: () => void;
}) {
  // Local state for inputs to prevent focus loss during parent re-renders
  const [localValue, setLocalValue] = useState(value);
  
  // Sync local state when prop changes from outside (not from our typing)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const check = smartCheck(localValue, futureDate);
  const makeSmart = useCallback(() => {
    const smartValue = toSmartRock(localValue, futureDate);
    setLocalValue(smartValue);
    onChange(smartValue);
  }, [localValue, futureDate, onChange]);

  const handleStringChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const handleFieldChange = useCallback((field: keyof VtoRock) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (typeof localValue === 'string') return;
    const newValue = { ...localValue, [field]: e.target.value };
    setLocalValue(newValue);
    onChange(newValue);
  }, [localValue, onChange]);

  if (typeof localValue === 'string') {
    return (
      <div className="flex items-center gap-2">
        <input
          className="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 break-words whitespace-pre-wrap"
          value={localValue}
          onChange={handleStringChange}
        />
        <SmartBadge
          valid={
            check.hasTitle && check.hasMetric && check.hasOwner && check.hasDue
          }
        />
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={makeSmart}
        >
          Make SMART
        </button>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 border rounded-md p-2">
      <div className="flex items-center justify-between">
        <div className="font-medium text-[12px]">Rock</div>
        <SmartBadge
          valid={
            check.hasTitle && check.hasMetric && check.hasOwner && check.hasDue
          }
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          placeholder="Title"
          className="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 break-words whitespace-pre-wrap"
          value={localValue.title}
          onChange={handleFieldChange('title')}
        />
        <input
          placeholder="Metric (measurable target)"
          className="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 break-words whitespace-pre-wrap"
          value={localValue.metric}
          onChange={handleFieldChange('metric')}
        />
        <input
          placeholder="Owner"
          className="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 break-words whitespace-pre-wrap"
          value={localValue.owner}
          onChange={handleFieldChange('owner')}
        />
        <input
          placeholder="Due date (e.g., March 31, 2025)"
          className="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 break-words whitespace-pre-wrap"
          value={localValue.dueDate}
          onChange={handleFieldChange('dueDate')}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
});

function VtoPreviewLayout({
  vto,
  setVto,
}: {
  vto: VtoData;
  setVto: (next: VtoData) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <VtoSectionHeader title="CORE VALUES" />
          <div className="p-4">
            <BulletedList
              items={vto.coreValues}
              onChange={(items) => setVto({ ...vto, coreValues: items })}
            />
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <VtoSectionHeader title="3-YEAR PICTURE™" />
          <div className="p-4 grid grid-cols-1 gap-3">
            <LabeledText
              label="Future Date"
              value={vto.threeYearPicture.futureDate}
              onChange={(val) =>
                setVto({
                  ...vto,
                  threeYearPicture: {
                    ...vto.threeYearPicture,
                    futureDate: val,
                  },
                })
              }
            />
            <LabeledText
              label="Revenue"
              value={vto.threeYearPicture.revenue}
              onChange={(val) =>
                setVto({
                  ...vto,
                  threeYearPicture: { ...vto.threeYearPicture, revenue: val },
                })
              }
            />
            <LabeledText
              label="Profit"
              value={vto.threeYearPicture.profit}
              onChange={(val) =>
                setVto({
                  ...vto,
                  threeYearPicture: { ...vto.threeYearPicture, profit: val },
                })
              }
            />
            <div>
              <div className="font-semibold text-[13px] mb-2">
                What does it look like?
              </div>
              <BulletedList
                items={vto.threeYearPicture.bullets}
                onChange={(items) =>
                  setVto({
                    ...vto,
                    threeYearPicture: {
                      ...vto.threeYearPicture,
                      bullets: items,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <VtoSectionHeader title="CORE FOCUS™" />
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledText
              label="Purpose"
              value={vto.coreFocus.purpose}
              onChange={(val) =>
                setVto({
                  ...vto,
                  coreFocus: { ...vto.coreFocus, purpose: val },
                })
              }
            />
            <LabeledText
              label="Our Niche"
              value={vto.coreFocus.niche}
              onChange={(val) =>
                setVto({
                  ...vto,
                  coreFocus: { ...vto.coreFocus, niche: val },
                })
              }
            />
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <VtoSectionHeader title="10-YEAR TARGET™" />
          <div className="p-4">
            <LabeledText
              label="10-Year Target"
              value={vto.tenYearTarget}
              onChange={(val) => setVto({ ...vto, tenYearTarget: val })}
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
        <VtoSectionHeader title="MARKETING STRATEGY" />
        <div className="p-4 grid grid-cols-1 gap-4">
          <LabeledText
            label="Target Market / The List"
            value={vto.marketingStrategy.targetMarket}
            onChange={(val) =>
              setVto({
                ...vto,
                marketingStrategy: {
                  ...vto.marketingStrategy,
                  targetMarket: val,
                },
              })
            }
          />
          <div>
            <div className="font-semibold text-[13px] mb-2">3 Uniques™</div>
            <BulletedList
              items={vto.marketingStrategy.threeUniques}
              onChange={(items) =>
                setVto({
                  ...vto,
                  marketingStrategy: {
                    ...vto.marketingStrategy,
                    threeUniques: items,
                  },
                })
              }
            />
          </div>
          <LabeledText
            label="Proven Process™"
            value={vto.marketingStrategy.provenProcess}
            onChange={(val) =>
              setVto({
                ...vto,
                marketingStrategy: {
                  ...vto.marketingStrategy,
                  provenProcess: val,
                },
              })
            }
          />
          <LabeledText
            label="Guarantee"
            value={vto.marketingStrategy.guarantee}
            onChange={(val) =>
              setVto({
                ...vto,
                marketingStrategy: { ...vto.marketingStrategy, guarantee: val },
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <VtoSectionHeader title="1-YEAR PLAN" />
          <div className="p-4 grid grid-cols-1 gap-3">
            <LabeledText
              label="Future Date"
              value={vto.oneYearPlan.futureDate}
              onChange={(val) =>
                setVto({
                  ...vto,
                  oneYearPlan: { ...vto.oneYearPlan, futureDate: val },
                })
              }
            />
            <LabeledText
              label="Revenue"
              value={vto.oneYearPlan.revenue}
              onChange={(val) =>
                setVto({
                  ...vto,
                  oneYearPlan: { ...vto.oneYearPlan, revenue: val },
                })
              }
            />
            <LabeledText
              label="Profit"
              value={vto.oneYearPlan.profit}
              onChange={(val) =>
                setVto({
                  ...vto,
                  oneYearPlan: { ...vto.oneYearPlan, profit: val },
                })
              }
            />
            <div>
              <div className="font-semibold text-[13px] mb-2">
                Goals for the Year
              </div>
              <BulletedList
                items={vto.oneYearPlan.goals}
                onChange={(items) =>
                  setVto({
                    ...vto,
                    oneYearPlan: { ...vto.oneYearPlan, goals: items },
                  })
                }
              />
            </div>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <VtoSectionHeader title="ROCKS" />
          <div className="p-4 grid grid-cols-1 gap-3">
            <LabeledText
              label="Future Date"
              value={vto.rocks.futureDate}
              onChange={(val) =>
                setVto({ ...vto, rocks: { ...vto.rocks, futureDate: val } })
              }
            />
            <div>
              <div className="font-semibold text-[13px] mb-1 flex items-center gap-2">
                <span>Rocks for the Quarter</span>
                {/* Overall SMART coverage badge */}
                {(() => {
                  const list = vto.rocks.rocks || [];
                  const total = list.filter((r) =>
                    typeof r === 'string' ? r.trim() : r.title?.trim(),
                  ).length;
                  const smartCount = list.filter((r) => {
                    const c = smartCheck(r, vto.rocks.futureDate);
                    return c.hasMetric && c.hasOwner && c.hasDue;
                  }).length;
                  const coverageOk =
                    total > 0 ? smartCount / total >= 0.9 : false;
                  return <SmartBadge valid={coverageOk} />;
                })()}
              </div>
              <div className="flex flex-col gap-2">
                {(vto.rocks.rocks || []).map((item, idx) => {
                  return (
                    <SmartRockRow
                      key={`rock-${idx}`}
                      value={item}
                      futureDate={vto.rocks.futureDate}
                      onChange={(next) => {
                        const updated = [...(vto.rocks.rocks || [])];
                        updated[idx] = next;
                        setVto({
                          ...vto,
                          rocks: { ...vto.rocks, rocks: updated },
                        });
                      }}
                      onRemove={() => {
                        const updated = (vto.rocks.rocks || []).filter(
                          (_, i) => i !== idx,
                        );
                        setVto({
                          ...vto,
                          rocks: { ...vto.rocks, rocks: updated },
                        });
                      }}
                    />
                  );
                })}
                <div>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() =>
                      setVto({
                        ...vto,
                        rocks: {
                          ...vto.rocks,
                          rocks: [...(vto.rocks.rocks || []), ''],
                        },
                      })
                    }
                  >
                    Add rock
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 cursor-help">
                      <InfoIcon size={12} />
                      <span>What is SMART?</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Specific, Measurable, Achievable, Relevant, Time-bound. EOS
                    Rocks are always SMART.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <VtoSectionHeader title="ISSUES LIST" />
          <div className="p-4">
            <BulletedList
              items={vto.issuesList}
              onChange={(items) => setVto({ ...vto, issuesList: items })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const vtoComposer = new Composer<'vto', Metadata>({
  kind: 'vto',
  description:
    'Build a Vision/Traction Organizer (V/TO) with dynamic editing and PDF export',
  initialize: async ({ setMetadata }) => {
    setMetadata({ vto: null });
  },
  onStreamPart: ({ streamPart, setMetadata, setComposer }) => {
    if (streamPart.type === 'text-delta') {
      // Server sends FULL content each time (not deltas), so REPLACE not accumulate
      const content = String(streamPart.content || '');
      
      // Try to parse the full content
      const parsed = parseVtoFromContent(content);
      if (parsed) {
        setMetadata((m: Metadata) => ({ ...(m || {}), vto: parsed }));
      }
      
      setComposer((draft) => ({
        ...draft,
        content: content,
        isVisible:
          draft.status === 'streaming' && content.length > 200
            ? true
            : draft.isVisible,
        status: 'streaming',
      }));
    }
  },
  content: ({
    content,
    onSaveContent,
    metadata,
    setMetadata,
    title,
    status,
    chatStatus,
  }) => {
    const previewRef = useRef<HTMLDivElement>(null);
    const lastValidVtoRef = useRef<VtoData | null>(null);
    const lastSavedJsonRef = useRef<string>('');
    const { setComposer } = useGlobalComposer();

    // Track last valid VTO parsed from full content to survive transient clears
    useEffect(() => {
      const parsed = parseVtoFromContent(content);
      if (parsed) {
        lastValidVtoRef.current = parsed;
      }
    }, [content]);

    const vto: VtoData = useMemo(() => {
      // Prefer live editable metadata first, then document content, then last valid, then default
      if (metadata?.vto) {
        return metadata.vto as VtoData;
      }

      const parsed = parseVtoFromContent(content);
      if (parsed) {
        return parsed;
      }

      if (lastValidVtoRef.current) {
        return lastValidVtoRef.current;
      }

      // For new/empty VTOs, always provide the default structure
      return defaultVto();
    }, [metadata?.vto, content]);

    const setVto = (next: VtoData) => {
      setMetadata((m: Metadata | null) => ({ ...(m || {}), vto: next }));
    };

    // Auto-save when VTO changes (simple, fire-and-forget)
    useEffect(() => {
      if (!vto) return;
      if (status === 'streaming') return;

      // Only persist meaningful VTO (avoid saving default/blank structures)
      if (!isMeaningfulVto(vto)) return;

      const json = JSON.stringify(vto);
      
      // Skip if content hasn't changed
      if (json === lastSavedJsonRef.current) return;
      lastSavedJsonRef.current = json;

      // Queue for background save (debounced in parent)
      const wrapped = `VTO_DATA_BEGIN\n${JSON.stringify(vto, null, 2)}\nVTO_DATA_END`;
      onSaveContent(wrapped, true);
    }, [vto, status, onSaveContent]);

    const exportPdf = async () => {
      try {
        const [{ default: html2canvas }, jspdf] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);
        const node = previewRef.current;
        if (!node) return;
        // Ensure we capture the latest edited VTO in content before exporting, without triggering stream clobber
        const json = JSON.stringify(vto, null, 2);
        const wrapped = `VTO_DATA_BEGIN\n${json}\nVTO_DATA_END`;
        if (wrapped !== (content || '')) {
          onSaveContent(wrapped, false);
        }
        const canvas = await html2canvas(node as HTMLElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF('p', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        if (imgHeight <= pageHeight - 40) {
          pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
        } else {
          let remaining = imgHeight;
          const canvasPageHeight = pageHeight - 40;
          let position = 0;
          const onePageCanvas = document.createElement('canvas');
          const ctx = onePageCanvas.getContext('2d');
          const ratio = imgWidth / canvas.width;
          onePageCanvas.width = canvas.width;
          onePageCanvas.height = canvasPageHeight / ratio;
          while (remaining > 0 && ctx) {
            ctx.clearRect(0, 0, onePageCanvas.width, onePageCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              position,
              canvas.width,
              onePageCanvas.height,
              0,
              0,
              onePageCanvas.width,
              onePageCanvas.height,
            );
            const pageImg = onePageCanvas.toDataURL('image/png');
            pdf.addImage(pageImg, 'PNG', 20, 20, imgWidth, canvasPageHeight);
            remaining -= canvasPageHeight;
            position += onePageCanvas.height;
            if (remaining > 0) pdf.addPage();
          }
        }
        const safe = (title || 'vto').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        pdf.save(`${safe}.pdf`);
        toast.success('Downloaded V/TO as PDF');
      } catch (e) {
        console.error(e);
        toast.error('Failed to export PDF');
      }
    };

    const isGenerating = status === 'streaming';

    return (
      <div className="relative flex flex-col gap-4 p-6">
        <ComposerEditingOverlay isVisible={isGenerating} chatStatus={chatStatus} />
        <div className="flex items-center justify-between rounded-lg border bg-white/70 dark:bg-zinc-900/70 backdrop-blur px-3 py-2">
          <div className="text-sm text-muted-foreground">V/TO Builder</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportPdf}
              disabled={isGenerating}
              className="text-xs px-3 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              Export PDF
            </button>
            <button
              type="button"
              disabled={isGenerating}
              className="text-xs px-3 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              onClick={async () => {
                try {
                  const res = await fetch('/api/user-settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      primaryVtoId:
                        (window as any)?.composer?.documentId || undefined,
                    }),
                  });
                  if (!res.ok) throw new Error('Failed to set primary');
                  toast.success('Set as primary V/TO');
                } catch (err) {
                  console.error(err);
                  toast.error('Failed to set as primary');
                }
              }}
            >
              Make Primary
            </button>
          </div>
        </div>
        <div className="relative">
          {isGenerating && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 dark:bg-black/70 rounded-lg pointer-events-auto backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-white bg-zinc-900/90 px-8 py-6 rounded-xl shadow-2xl border border-zinc-700">
                <div className="animate-spin h-8 w-8 rounded-full border-3 border-white/30 border-t-white" />
                <div className="text-lg font-medium">Generating V/TO</div>
                <div className="text-sm text-zinc-400">Please wait...</div>
              </div>
            </div>
          )}
          <div
            ref={previewRef}
            className={`bg-white dark:bg-zinc-900 p-6 rounded-lg border transition-opacity ${isGenerating ? 'pointer-events-none' : ''}`}
          >
            <VtoPreviewLayout vto={vto} setVto={setVto} />
          </div>
        </div>
      </div>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => handleVersionChange('prev'),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => handleVersionChange('next'),
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy JSON',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('V/TO JSON copied to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download PDF',
      onClick: async () => {
        toast.info('Use the Export PDF button in the header to download.');
      },
    },
  ],
  toolbar: [],
});
