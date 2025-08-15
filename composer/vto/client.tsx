'use client';

import { Artifact } from '@/components/create-composer';
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from '@/components/icons';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef } from 'react';

// Data model for a Vision/Traction Organizer (V/TO)
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
    rocks: string[];
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
    const parsed = JSON.parse(jsonStr) as VtoData;
    if (!parsed || !parsed.coreValues || !parsed.coreFocus) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isNonEmpty(str: string | undefined | null): boolean {
  return !!str && str.trim().length > 0;
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
        className="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function BulletedList({
  items,
  onChange,
  addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <div
          key={`${idx}-${item.slice(0, 3)}-${items.length}`}
          className="flex items-center gap-2"
        >
          <div className="text-sm text-muted-foreground w-4">{idx + 1}.</div>
          <input
            className="flex-1 border rounded-md px-3 py-2 text-sm dark:bg-zinc-900"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[idx] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
          >
            Remove
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => onChange([...items, ''])}
        >
          {addLabel ?? 'Add row'}
        </button>
      </div>
    </div>
  );
}

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
              <div className="font-semibold text-[13px] mb-2">
                Rocks for the Quarter
              </div>
              <BulletedList
                items={vto.rocks.rocks}
                onChange={(items) =>
                  setVto({ ...vto, rocks: { ...vto.rocks, rocks: items } })
                }
              />
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

export const vtoArtifact = new Artifact<'vto', Metadata>({
  kind: 'vto',
  description:
    'Build a Vision/Traction Organizer (V/TO) with dynamic editing and PDF export',
  initialize: async ({ setMetadata }) => {
    setMetadata({ vto: null });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === 'text-delta') {
      const text = String(streamPart.content || '');
      const parsed = parseVtoFromContent(text);
      if (parsed) {
        setMetadata((m: Metadata) => ({ ...(m || {}), vto: parsed }));
      }
      setArtifact((draft) => ({
        ...draft,
        content: draft.content + text,
        isVisible:
          draft.status === 'streaming' && draft.content.length > 200
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
  }) => {
    const previewRef = useRef<HTMLDivElement>(null);
    const lastValidVtoRef = useRef<VtoData | null>(null);

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

    // Persist when local VTO differs from current content (avoid loops, streaming clobber, and empty/default saves)
    useEffect(() => {
      if (!vto) return;
      if (status === 'streaming') return;

      // Only persist meaningful VTO (avoid saving default/blank structures)
      if (!isMeaningfulVto(vto)) return;

      const hasValidInContent = !!parseVtoFromContent(content);

      const json = JSON.stringify(vto, null, 2);
      const wrapped = `VTO_DATA_BEGIN\n${json}\nVTO_DATA_END`;
      // Persist if user edited metadata OR we differ from current content
      if (wrapped !== (content || '') || !hasValidInContent)
        onSaveContent(wrapped, true);
    }, [vto, content, status, onSaveContent]);

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
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">V/TO Builder</div>
          <button
            type="button"
            onClick={exportPdf}
            className="text-xs px-3 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Export PDF
          </button>
        </div>
        <div className="relative">
          {isGenerating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 rounded-lg border">
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-5 w-5 rounded-full border-2 border-zinc-300 border-t-transparent" />
                <div>Generating your V/TO…</div>
              </div>
            </div>
          )}
          <div
            ref={previewRef}
            className="bg-white dark:bg-zinc-900 p-6 rounded-lg border"
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
        toast.message('Use the Export PDF button in the header to download.');
      },
    },
  ],
  toolbar: [],
});
