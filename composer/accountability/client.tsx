'use client';

import { Composer } from '@/components/create-composer';
import { ComposerEditingOverlay } from '@/components/composer-editing-overlay';
import { useComposer as useGlobalComposer } from '@/hooks/use-composer';
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from '@/components/icons';
import { toast } from '@/lib/toast-system';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import React from 'react';
import { AnimatedModal } from '@/components/animated-modal';
import RecordingModal from '@/components/recording-modal';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  Position,
  Handle,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Users,
  Mic,
  Square,
  FileAudio,
  Plus,
  Calendar as CalendarIcon,
} from 'lucide-react';

// EOS data model extensions
type EosGwc = {
  getsIt?: boolean;
  wantsIt?: boolean;
  capacity?: boolean;
};

type EosCoreValueRating = {
  name: string;
  rating?: number; // 0-5, optional
};

type EosRock = {
  id: string;
  title: string;
  quarter: string; // e.g., 2025-Q1
  status: 'onTrack' | 'offTrack' | 'done';
  dueDate?: string; // ISO date
};

type EosMeasurable = {
  id: string;
  name: string;
  target: string; // e.g., '100', '95%'
  unit?: string; // optional units
  owner?: string; // optional owner
};

type EosProcess = {
  id: string;
  name: string;
  url?: string;
  docId?: string;
};

type EosData = {
  gwc?: EosGwc;
  coreValues?: EosCoreValueRating[];
  rocks?: EosRock[];
  measurables?: EosMeasurable[];
  issuesCount?: number;
  processes?: EosProcess[];
  issues?: { id: string; title: string; status: 'open' | 'solved' }[];
  notes?: string;
};

// Data model for an EOS Accountability Chart (hierarchical seats)
export interface SeatNode {
  id: string;
  name: string;
  holder: string;
  roles: string[];
  children: SeatNode[];
  accent?: string;
  eos?: EosData;
}

export interface AccountabilityChartData {
  version: number;
  title?: string;
  root: SeatNode;
}

// L10 Meeting Types
type L10AgendaItem = {
  id: string;
  type:
    | 'segue'
    | 'scorecard'
    | 'rocks'
    | 'headlines'
    | 'todo'
    | 'ids'
    | 'conclusion';
  title: string;
  duration: number; // minutes
  completed: boolean;
  notes?: string;
  recordingId?: string; // Link to vocal recording
  startTime?: number; // Timestamp when this agenda item started
};

type L10Issue = {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  owner?: string; // Seat ID
  status: 'identified' | 'discussing' | 'solving' | 'solved';
  recordingId?: string;
};

type L10ToDo = {
  id: string;
  task: string;
  owner: string; // Seat ID
  dueDate?: string;
  completed: boolean;
  fromMeeting?: string; // Meeting date
};

type L10Meeting = {
  id: string;
  date: string;
  attendees: string[]; // Seat IDs
  agenda: L10AgendaItem[];
  issues: L10Issue[];
  todos: L10ToDo[];
  rating?: number; // 1-10 meeting rating
  recordingId?: string; // Main meeting recording
  summary?: string;
};

type Metadata = {
  ac: AccountabilityChartData | null;
  acLayout?: Record<string, { x: number; y: number }>;
  layoutMode?: 'balanced' | 'manual';
  selectedQuarter?: string; // e.g., 2025-Q1
  l10Enabled?: boolean;
  l10Meetings?: L10Meeting[];
  activeMeetingId?: string;
  composerId?: string; // Unique ID for this AC composer instance
  l10Recording?: {
    active: boolean;
    startedAt: number;
    currentItemId?: string;
  };
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getCurrentQuarterString(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const q = Math.floor(month / 3) + 1;
  return `${year}-Q${q}`;
}

function getQuarterList(center?: string, span = 3): string[] {
  // Returns [prev...center...next] quarters around the center
  const parts = (center || getCurrentQuarterString()).split('-Q');
  const year = Number.parseInt(parts[0] || `${new Date().getFullYear()}`, 10);
  const quarter = Number.parseInt(parts[1] || '1', 10);
  const result: string[] = [];
  // previous
  let y: number = year;
  let q: number = quarter;
  for (let i = span; i > 0; i--) {
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
    result.unshift(`${y}-Q${q}`);
  }
  // center
  result.push(`${year}-Q${quarter}`);
  // next
  y = year;
  q = quarter;
  for (let i = 0; i < span; i++) {
    q += 1;
    if (q === 5) {
      q = 1;
      y += 1;
    }
    result.push(`${y}-Q${q}`);
  }
  return result;
}

function normalizeSeat(node: SeatNode): SeatNode {
  const id = node.id || generateId();
  const name = node.name || 'New Seat';
  const holder = node.holder ?? '';
  const roles = Array.isArray(node.roles) ? node.roles : [];
  const accent = node.accent || '#3b82f6';
  const eos = node.eos
    ? {
        ...node.eos,
        coreValues: Array.isArray(node.eos.coreValues)
          ? node.eos.coreValues
          : [],
        rocks: Array.isArray(node.eos.rocks) ? node.eos.rocks : [],
        measurables: Array.isArray(node.eos.measurables)
          ? node.eos.measurables
          : [],
        processes: Array.isArray(node.eos.processes) ? node.eos.processes : [],
      }
    : undefined;
  const children = Array.isArray(node.children) ? node.children : [];
  return {
    id,
    name,
    holder,
    roles,
    accent,
    eos,
    children: children.map((c) => normalizeSeat(c)),
  };
}

function normalizeChart(
  data: AccountabilityChartData,
): AccountabilityChartData {
  return {
    version: typeof data.version === 'number' ? data.version : 1,
    title: data.title,
    root: normalizeSeat(data.root),
  };
}

function defaultChart(): AccountabilityChartData {
  return {
    version: 1,
    root: {
      id: generateId(),
      name: 'VISIONARY',
      holder: 'Seat Holder',
      roles: [
        'Define the vision',
        'Build key relationships',
        'Solve big problems',
        'Create company culture',
      ],
      accent: '#3b82f6',
      children: [
        {
          id: generateId(),
          name: 'INTEGRATOR',
          holder: 'Seat Holder',
          roles: [
            'Lead the leadership team',
            'Execute the vision',
            'Hold people accountable',
            'Resolve issues',
          ],
          accent: '#3b82f6',
          children: [
            {
              id: generateId(),
              name: 'MARKETING/SALES',
              holder: 'Seat Holder',
              roles: [
                'Generate demand',
                'Convert leads to customers',
                'Retain customers',
                'Build brand',
              ],
              accent: '#3b82f6',
              children: [],
            },
            {
              id: generateId(),
              name: 'OPERATIONS',
              holder: 'Seat Holder',
              roles: [
                'Deliver the product/service',
                'Ensure quality',
                'Optimize processes',
                'Manage resources',
              ],
              accent: '#3b82f6',
              children: [],
            },
            {
              id: generateId(),
              name: 'FINANCE',
              holder: 'Seat Holder',
              roles: [
                'Manage cash flow',
                'Financial reporting',
                'Budget planning',
                'Risk management',
              ],
              accent: '#3b82f6',
              children: [],
            },
          ],
        },
      ],
    },
  };
}

function parseACFromContent(
  content: string | undefined,
): AccountabilityChartData | null {
  if (!content) return null;
  try {
    const hasBegin = content.includes('AC_DATA_BEGIN');
    const hasEnd = content.includes('AC_DATA_END');
    let jsonStr = content;
    if (hasBegin && hasEnd) {
      const start = content.indexOf('AC_DATA_BEGIN') + 'AC_DATA_BEGIN'.length;
      const end = content.indexOf('AC_DATA_END');
      jsonStr = content.substring(start, end).trim();
    }
    const parsed = JSON.parse(jsonStr) as AccountabilityChartData;
    if (!parsed || !parsed.root) return null;
    // normalize defaults
    if (typeof (parsed as any).version !== 'number') {
      (parsed as any).version = 1;
    }
    // Ensure title exists
    if (!parsed.title) {
      console.warn('[AC] Parsed data missing title field, using fallback');
      parsed.title = 'Accountability Chart';
    }
    return parsed;
  } catch {
    return null;
  }
}

function SeatField({
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
      <div className="font-semibold text-[12px] text-zinc-700 dark:text-zinc-300">
        {label}
      </div>
      <input
        className="border rounded-md px-2 py-1 text-sm dark:bg-zinc-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function RolesEditor({
  roles,
  onChange,
}: {
  roles: string[];
  onChange: (next: string[]) => void;
}) {
  const keysRef = useRef<string[]>([]);
  useEffect(() => {
    // Grow keys for new items
    while (keysRef.current.length < roles.length) {
      keysRef.current.push(
        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
    }
    // Shrink keys if roles were removed
    if (keysRef.current.length > roles.length) {
      keysRef.current = keysRef.current.slice(0, roles.length);
    }
  }, [roles.length]);

  return (
    <div className="space-y-3">
      {roles.map((r, i) => (
        <div key={keysRef.current[i]} className="flex items-center gap-2 group">
          <div className="text-sm text-gray-500 dark:text-zinc-300 w-6">
            {i + 1}.
          </div>
          <input
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
            value={r}
            onChange={(e) => {
              const next = [...roles];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder="Enter role or responsibility..."
          />
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all"
            onClick={() => onChange(roles.filter((_, idx) => idx !== i))}
            title="Remove role"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center justify-center gap-2"
        onClick={() => onChange([...roles, ''])}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add Role
      </button>
    </div>
  );
}

function mapTree(
  node: SeatNode,
  predicate: (n: SeatNode) => boolean,
  updater: (n: SeatNode) => SeatNode,
): SeatNode {
  const match = predicate(node);
  const next: SeatNode = match ? updater(node) : { ...node };
  // IMPORTANT: When the current node matches and is updated (e.g. children added),
  // we must recurse over the UPDATED children, not the original ones. Otherwise, the
  // newly added child will be lost by overwriting with the original children array.
  const baseChildren = match ? next.children : node.children;
  next.children = (baseChildren || []).map((c) =>
    mapTree(c, predicate, updater),
  );
  return next;
}

function deleteFromTree(root: SeatNode, nodeId: string): SeatNode {
  const walk = (n: SeatNode): SeatNode => {
    return {
      ...n,
      children: n.children.filter((c) => c.id !== nodeId).map((c) => walk(c)),
    };
  };
  return walk(root);
}

function addChild(
  root: SeatNode,
  parentId: string,
  child?: Partial<SeatNode>,
): SeatNode {
  const newSeat: SeatNode = {
    id: generateId(),
    name: child?.name || 'New Seat',
    holder: child?.holder || '',
    roles: child?.roles || [],
    accent: child?.accent || '#3b82f6',
    eos: child?.eos,
    children: child?.children || [],
  };
  return mapTree(
    root,
    (n) => n.id === parentId,
    (n) => ({ ...n, children: [...n.children, newSeat] }),
  );
}

function mergeEos(base?: EosData, updates?: EosData): EosData | undefined {
  if (!base && !updates) return undefined;
  const b = base || {};
  const u = updates || {};
  return {
    ...b,
    ...u,
    gwc: { ...(b.gwc || {}), ...(u.gwc || {}) },
    coreValues: u.coreValues !== undefined ? u.coreValues : b.coreValues,
    rocks: u.rocks !== undefined ? u.rocks : b.rocks,
    measurables: u.measurables !== undefined ? u.measurables : b.measurables,
    processes: u.processes !== undefined ? u.processes : b.processes,
  };
}

function updateSeat(
  root: SeatNode,
  seatId: string,
  updates: Partial<SeatNode>,
): SeatNode {
  return mapTree(
    root,
    (n) => n.id === seatId,
    (n) => ({
      ...n,
      name: updates.name !== undefined ? updates.name : n.name,
      holder: updates.holder !== undefined ? updates.holder : n.holder,
      roles: updates.roles !== undefined ? updates.roles : n.roles,
      accent: updates.accent !== undefined ? updates.accent : n.accent,
      eos: mergeEos(n.eos, updates.eos),
    }),
  );
}

function SeatCard({
  node,
  isRoot,
  onUpdate,
  onAddChild,
  onRemove,
}: {
  node: SeatNode;
  isRoot?: boolean;
  onUpdate: (n: SeatNode) => void;
  onAddChild: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [openRoles, setOpenRoles] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftHolder, setDraftHolder] = useState('');
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const scheduleQuarterlySession = useCallback(async () => {
    try {
      const now = new Date();
      // Next Tuesday at 9:00 local, 4 hours
      const day = now.getDay();
      const daysUntilTue = (2 - day + 7) % 7 || 7;
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + daysUntilTue,
        9,
        0,
        0,
      );
      const end = new Date(start.getTime() + 4 * 60 * 60000);
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: 'Quarterly Session',
          description:
            'EOS Quarterly Session – scheduled from Accountability Chart',
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create event');
      }
      const data = await res.json();
      toast.success('Quarterly Session scheduled');
      if (data?.htmlLink) {
        try {
          window.open(data.htmlLink, '_blank');
        } catch (_) {}
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to schedule');
    }
  }, []);
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 w-[260px]">
      <div className="bg-slate-700 text-white px-4 py-2 text-sm font-semibold tracking-wide flex items-center justify-between">
        <span>{node.name || 'Seat'}</span>
        {isRoot && (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
            onClick={scheduleQuarterlySession}
            title="Schedule Quarterly Session"
          >
            <CalendarIcon className="w-3.5 h-3.5 inline-block mr-1" />
            Schedule
          </button>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <SeatField
          label="Seat Name"
          value={node.name}
          onChange={(v) => onUpdate({ ...node, name: v })}
        />
        <SeatField
          label="Seat Holder"
          value={node.holder}
          onChange={(v) => onUpdate({ ...node, holder: v })}
        />
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md border w-fit hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => setOpenRoles((o) => !o)}
        >
          {openRoles ? 'Hide Roles' : 'Edit Roles'}
        </button>
        {openRoles && (
          <RolesEditor
            roles={node.roles}
            onChange={(roles) => onUpdate({ ...node, roles })}
          />
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setIsAddOpen(true);
            }}
          >
            Add Seat
          </button>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setIsAddOpen(false)}
          >
            Customize
          </button>
          {!isRoot && (
            <button
              type="button"
              className="text-xs px-2 py-1 rounded-md border hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => onRemove(node.id)}
            >
              Remove
            </button>
          )}
        </div>
        {isAddOpen && (
          <SeatModal
            mode="add"
            initial={{}}
            onClose={() => setIsAddOpen(false)}
            onSubmit={(data) => {
              (window as any).__ac_newSeatForParent = data;
              onAddChild(node.id);
              (window as any).__ac_newSeatForParent = undefined;
              setIsAddOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function TreeView({
  node,
  onChange,
  isRoot,
}: {
  node: SeatNode;
  onChange: (n: SeatNode) => void;
  isRoot?: boolean;
}) {
  // Basic drag-and-drop using pointer events (reparent on drop)
  const dragData = useRef<{ id: string } | null>(null);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    dragData.current = { id };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent, targetId: string) => {
    const data = dragData.current;
    dragData.current = null;
    if (!data || data.id === targetId) return;
    // Reparent dragged node under targetId
    const removeThenAdd = (root: SeatNode): SeatNode => {
      // Extract dragged node
      let dragged: SeatNode | null = null;
      const remove = (n: SeatNode): SeatNode => ({
        ...n,
        children: n.children
          .filter((c) => {
            if (c.id === data.id) {
              dragged = c;
              return false;
            }
            return true;
          })
          .map(remove),
      });
      const pruned = remove(root);
      if (!dragged) return root; // nothing to do
      return addChild(pruned, targetId, dragged);
    };
    onChange(removeThenAdd(node));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <SeatCard
        node={node}
        isRoot={isRoot}
        onUpdate={(updated) => onChange(updated)}
        onAddChild={(id) => {
          const details = (window as any).__ac_newSeatForParent as
            | Partial<SeatNode>
            | undefined;
          onChange(addChild(node, id, details));
        }}
        onRemove={(id) => onChange(deleteFromTree(node, id))}
      />
      {node.children.length > 0 && (
        <div className="w-full flex flex-col items-center">
          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex gap-6 justify-center">
            {node.children.map((child) => (
              <div
                key={child.id}
                className="flex flex-col items-center"
                onPointerDown={(e) => onPointerDown(e, child.id)}
                onPointerUp={(e) => onPointerUp(e, child.id)}
              >
                <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                <TreeView
                  node={child}
                  onChange={(updatedChild) => {
                    const next = mapTree(
                      node,
                      (n) => n.id === child.id,
                      () => updatedChild,
                    );
                    onChange(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeatModal({
  mode,
  initial,
  onSubmit,
  onClose,
}: {
  mode: 'add' | 'edit';
  initial: Partial<SeatNode>;
  onSubmit: (data: Partial<SeatNode>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name || '');
  const [holder, setHolder] = useState(initial.holder || '');
  const [roles, setRoles] = useState<string[]>(initial.roles || []);
  const [accent, setAccent] = useState(initial.accent || '#3b82f6');

  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      title={mode === 'add' ? 'Add New Seat' : 'Edit Seat'}
      size="md"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="seat-name"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Seat Name
            </label>
            <input
              id="seat-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., VISIONARY, INTEGRATOR"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="seat-holder"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Seat Holder
            </label>
            <input
              id="seat-holder"
              type="text"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="Person's name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="accent-color"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="accent-color"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
              />
              <span className="text-sm text-gray-500">{accent}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Roles & Responsibilities
          </p>
          <RolesEditor roles={roles} onChange={setRoles} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            onClick={() =>
              onSubmit({ name: name || 'New Seat', holder, roles, accent })
            }
          >
            {mode === 'add' ? 'Add Seat' : 'Save Changes'}
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

// Utility to walk the tree and collect seats
function flattenSeats(root: SeatNode): SeatNode[] {
  const result: SeatNode[] = [];
  const stack: SeatNode[] = [root];
  while (stack.length) {
    const n = stack.pop() as SeatNode;
    result.push(n);
    for (const c of n.children) stack.push(c);
  }
  return result;
}

function updateSeatEos(
  ac: AccountabilityChartData,
  seatId: string,
  eosUpdater: (prev: EosData | undefined) => EosData | undefined,
): AccountabilityChartData {
  const nextRoot = mapTree(
    ac.root,
    (n) => n.id === seatId,
    (n) => ({
      ...n,
      eos: eosUpdater(n.eos),
    }),
  );
  return { ...ac, root: nextRoot };
}

// People Analyzer Modal: edit GWC and core values for a seat and its direct reports
function PeopleAnalyzerModal({
  seat,
  parent,
  onClose,
  onSave,
}: {
  seat: SeatNode;
  parent?: SeatNode | null;
  onClose: () => void;
  onSave: (updates: Record<string, EosData>) => void;
}) {
  const targets: SeatNode[] = [seat, ...seat.children];
  const [draft, setDraft] = useState<Record<string, EosData>>(() => {
    const init: Record<string, EosData> = {};
    for (const s of targets) {
      init[s.id] = {
        ...(s.eos || {}),
        gwc: {
          getsIt: !!s.eos?.gwc?.getsIt,
          wantsIt: !!s.eos?.gwc?.wantsIt,
          capacity: !!s.eos?.gwc?.capacity,
        },
        coreValues: Array.isArray(s.eos?.coreValues) ? s.eos?.coreValues : [],
      };
    }
    return init;
  });

  const setGwc = (id: string, key: keyof EosGwc, value: boolean) => {
    setDraft((d) => ({
      ...d,
      [id]: { ...(d[id] || {}), gwc: { ...(d[id]?.gwc || {}), [key]: value } },
    }));
  };

  const addCoreValue = (id: string) => {
    setDraft((d) => ({
      ...d,
      [id]: {
        ...(d[id] || {}),
        coreValues: [...(d[id]?.coreValues || []), { name: '', rating: 0 }],
      },
    }));
  };
  const setCoreValue = (id: string, idx: number, cv: EosCoreValueRating) => {
    setDraft((d) => {
      const list = [...(d[id]?.coreValues || [])];
      list[idx] = cv;
      return { ...d, [id]: { ...(d[id] || {}), coreValues: list } };
    });
  };
  const removeCoreValue = (id: string, idx: number) => {
    setDraft((d) => {
      const list = [...(d[id]?.coreValues || [])];
      list.splice(idx, 1);
      return { ...d, [id]: { ...(d[id] || {}), coreValues: list } };
    });
  };

  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      title="People Analyzer"
      size="lg"
    >
      <div className="space-y-4 modal-solid">
        <div className="text-xs text-gray-500">
          Seat:{' '}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {seat.name}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-gray-50 dark:bg-zinc-800/50 dark:border-zinc-700">
                <th className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300">
                  Seat
                </th>
                <th className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300">
                  Gets it
                </th>
                <th className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300">
                  Wants it
                </th>
                <th className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300">
                  Capacity
                </th>
                <th className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300">
                  Core Values
                </th>
              </tr>
            </thead>
            <tbody>
              {targets.map((s) => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 dark:border-zinc-800"
                >
                  <td className="py-3 px-3">
                    {s.name}{' '}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {s.holder ? `(${s.holder})` : ''}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-eos-orange focus:ring-eos-orange"
                      checked={!!draft[s.id]?.gwc?.getsIt}
                      onChange={(e) => setGwc(s.id, 'getsIt', e.target.checked)}
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-eos-orange focus:ring-eos-orange"
                      checked={!!draft[s.id]?.gwc?.wantsIt}
                      onChange={(e) =>
                        setGwc(s.id, 'wantsIt', e.target.checked)
                      }
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-eos-orange focus:ring-eos-orange"
                      checked={!!draft[s.id]?.gwc?.capacity}
                      onChange={(e) =>
                        setGwc(s.id, 'capacity', e.target.checked)
                      }
                    />
                  </td>
                  <td className="py-3 px-3">
                    <div className="space-y-2">
                      {(draft[s.id]?.coreValues || []).map((cv, i) => (
                        <div
                          key={`${s.id}-cv-${i}`}
                          className="flex items-center gap-2"
                        >
                          <input
                            className="px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-eos-orange/50"
                            value={cv.name}
                            onChange={(e) =>
                              setCoreValue(s.id, i, {
                                ...cv,
                                name: e.target.value,
                              })
                            }
                            placeholder="Value"
                          />
                          <input
                            className="px-2 py-1.5 text-xs border rounded-md w-16 bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-eos-orange/50"
                            type="number"
                            value={cv.rating ?? 0}
                            onChange={(e) =>
                              setCoreValue(s.id, i, {
                                ...cv,
                                rating: Number(e.target.value),
                              })
                            }
                          />
                          <button
                            type="button"
                            className="text-xs px-2 py-1.5 border rounded-md hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20 dark:border-zinc-700 transition-colors"
                            onClick={() => removeCoreValue(s.id, i)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-xs px-2 py-1.5 border rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 dark:border-zinc-700 transition-colors"
                        onClick={() => addCoreValue(s.id)}
                      >
                        Add Value
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t dark:border-zinc-700">
          <button
            type="button"
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 dark:border-zinc-700 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-md bg-eos-orange hover:bg-eos-orange/90 text-white transition-colors"
            onClick={() => onSave(draft)}
          >
            Save
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

function RocksModal({
  seat,
  quarter,
  onClose,
  onSave,
}: {
  seat: SeatNode;
  quarter: string;
  onClose: () => void;
  onSave: (rocks: EosRock[]) => void;
}) {
  const [rocks, setRocks] = useState<EosRock[]>(() =>
    Array.isArray(seat.eos?.rocks) ? (seat.eos?.rocks as EosRock[]) : [],
  );
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'onTrack' | 'offTrack' | 'done'>(
    'onTrack',
  );

  const addRock = () => {
    if (!title.trim()) return;
    const r: EosRock = {
      id: generateId(),
      title: title.trim(),
      quarter,
      status,
    };
    setRocks((list) => [...list, r]);
    setTitle('');
    setStatus('onTrack');
  };
  const removeRock = (id: string) =>
    setRocks((list) => list.filter((r) => r.id !== id));
  const updateRock = (id: string, u: Partial<EosRock>) =>
    setRocks((list) => list.map((r) => (r.id === id ? { ...r, ...u } : r)));

  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      title={`Rocks – ${seat.name}`}
      size="md"
    >
      <div className="space-y-3 modal-solid">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 px-2 py-1 text-sm border rounded"
            placeholder={`Add rock for ${quarter}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="px-2 py-1 text-sm border rounded"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="onTrack">On Track</option>
            <option value="offTrack">Off Track</option>
            <option value="done">Done</option>
          </select>
          <button
            type="button"
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white"
            onClick={addRock}
          >
            Add
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {rocks.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 border rounded p-2"
            >
              <input
                className="flex-1 px-2 py-1 text-sm border rounded"
                value={r.title}
                onChange={(e) => updateRock(r.id, { title: e.target.value })}
              />
              <select
                className="px-2 py-1 text-sm border rounded"
                value={r.status}
                onChange={(e) =>
                  updateRock(r.id, { status: e.target.value as any })
                }
              >
                <option value="onTrack">On Track</option>
                <option value="offTrack">Off Track</option>
                <option value="done">Done</option>
              </select>
              <button
                type="button"
                className="px-2 py-1 text-sm border rounded"
                onClick={() => removeRock(r.id)}
              >
                Remove
              </button>
            </div>
          ))}
          {rocks.length === 0 && (
            <div className="text-xs text-gray-500 dark:text-zinc-300">
              No rocks yet.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm border rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white"
            onClick={() => onSave(rocks)}
          >
            Save
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

function MeasurablesModal({
  seat,
  onClose,
  onSave,
}: {
  seat: SeatNode;
  onClose: () => void;
  onSave: (measurables: EosMeasurable[]) => void;
}) {
  const [list, setList] = useState<EosMeasurable[]>(() =>
    Array.isArray(seat.eos?.measurables)
      ? (seat.eos?.measurables as EosMeasurable[])
      : [],
  );
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const add = () => {
    if (!name.trim()) return;
    setList((l) => [
      ...l,
      {
        id: generateId(),
        name: name.trim(),
        target: target.trim(),
        unit: unit.trim() || undefined,
      },
    ]);
    setName('');
    setTarget('');
    setUnit('');
  };
  const remove = (id: string) => setList((l) => l.filter((m) => m.id !== id));
  const update = (id: string, u: Partial<EosMeasurable>) =>
    setList((l) => l.map((m) => (m.id === id ? { ...m, ...u } : m)));
  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      title={`Measurables – ${seat.name}`}
      size="md"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 px-2 py-1 text-sm border rounded"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="px-2 py-1 text-sm border rounded w-24"
            placeholder="Target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <input
            className="px-2 py-1 text-sm border rounded w-24"
            placeholder="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white"
            onClick={add}
          >
            Add
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {list.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 border rounded p-2"
            >
              <input
                className="flex-1 px-2 py-1 text-sm border rounded"
                value={m.name}
                onChange={(e) => update(m.id, { name: e.target.value })}
              />
              <input
                className="px-2 py-1 text-sm border rounded w-24"
                value={m.target}
                onChange={(e) => update(m.id, { target: e.target.value })}
              />
              <input
                className="px-2 py-1 text-sm border rounded w-24"
                value={m.unit || ''}
                onChange={(e) => update(m.id, { unit: e.target.value })}
              />
              <button
                type="button"
                className="px-2 py-1 text-sm border rounded"
                onClick={() => remove(m.id)}
              >
                Remove
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="text-xs text-gray-500 dark:text-zinc-300">
              No measurables yet.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm border rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white"
            onClick={() => onSave(list)}
          >
            Save
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

function ProcessesModal({
  seat,
  onClose,
  onSave,
}: {
  seat: SeatNode;
  onClose: () => void;
  onSave: (processes: EosProcess[]) => void;
}) {
  const [list, setList] = useState<EosProcess[]>(() =>
    Array.isArray(seat.eos?.processes)
      ? (seat.eos?.processes as EosProcess[])
      : [],
  );
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const add = () => {
    if (!name.trim()) return;
    setList((l) => [
      ...l,
      { id: generateId(), name: name.trim(), url: url.trim() || undefined },
    ]);
    setName('');
    setUrl('');
  };
  const remove = (id: string) => setList((l) => l.filter((m) => m.id !== id));
  const update = (id: string, u: Partial<EosProcess>) =>
    setList((l) => l.map((m) => (m.id === id ? { ...m, ...u } : m)));
  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      title={`Processes – ${seat.name}`}
      size="md"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 px-2 py-1 text-sm border rounded"
            placeholder="Process name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="flex-1 px-2 py-1 text-sm border rounded"
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white"
            onClick={add}
          >
            Add
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {list.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 border rounded p-2"
            >
              <input
                className="flex-1 px-2 py-1 text-sm border rounded"
                value={m.name}
                onChange={(e) => update(m.id, { name: e.target.value })}
              />
              <input
                className="flex-1 px-2 py-1 text-sm border rounded"
                value={m.url || ''}
                onChange={(e) => update(m.id, { url: e.target.value })}
              />
              <button
                type="button"
                className="px-2 py-1 text-sm border rounded"
                onClick={() => remove(m.id)}
              >
                Remove
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="text-xs text-gray-500 dark:text-zinc-300">
              No processes yet.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm border rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white"
            onClick={() => onSave(list)}
          >
            Save
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

function IssuesModal({
  seat,
  onClose,
  onSave,
}: {
  seat: SeatNode;
  onClose: () => void;
  onSave: (
    issues: { id: string; title: string; status: 'open' | 'solved' }[],
  ) => void;
}) {
  const [list, setList] = useState<
    { id: string; title: string; status: 'open' | 'solved' }[]
  >(() =>
    Array.isArray(seat.eos?.issues)
      ? (seat.eos?.issues as {
          id: string;
          title: string;
          status: 'open' | 'solved';
        }[])
      : [],
  );
  const [title, setTitle] = useState('');
  const add = () => {
    if (!title.trim()) return;
    setList((l) => [
      ...l,
      { id: generateId(), title: title.trim(), status: 'open' },
    ]);
    setTitle('');
  };
  const toggle = (id: string) =>
    setList((l) =>
      l.map((i) =>
        i.id === id
          ? { ...i, status: i.status === 'open' ? 'solved' : 'open' }
          : i,
      ),
    );
  const remove = (id: string) => setList((l) => l.filter((i) => i.id !== id));
  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      title={`Issues (L10) – ${seat.name}`}
      size="md"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 px-2 py-1 text-sm border rounded"
            placeholder="New issue"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white"
            onClick={add}
          >
            Add
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {list.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-2 border rounded p-2"
            >
              <input
                className="flex-1 px-2 py-1 text-sm border rounded"
                value={i.title}
                onChange={(e) =>
                  setList((l) =>
                    l.map((x) =>
                      x.id === i.id ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="px-2 py-1 text-sm border rounded"
                onClick={() => toggle(i.id)}
              >
                {i.status === 'open' ? 'Mark Solved' : 'Reopen'}
              </button>
              <button
                type="button"
                className="px-2 py-1 text-sm border rounded"
                onClick={() => remove(i.id)}
              >
                Remove
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="text-xs text-gray-500 dark:text-zinc-300">
              No issues yet.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm border rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white"
            onClick={() => onSave(list)}
          >
            Save
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

function ScorecardModal({
  seat,
  onClose,
}: { seat: SeatNode; onClose: () => void }) {
  const seats = flattenSeats(seat);
  const measurables: EosMeasurable[] = seats.flatMap(
    (s) => s.eos?.measurables || [],
  );
  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      title={`Scorecard – ${seat.name}`}
      size="lg"
    >
      <div className="space-y-2 max-h-[70vh] overflow-auto">
        {measurables.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-zinc-300">
            No measurables configured.
          </div>
        )}
        {measurables.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Measurable</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Unit</th>
              </tr>
            </thead>
            <tbody>
              {measurables.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{m.name}</td>
                  <td className="py-2 pr-3">{m.target}</td>
                  <td className="py-2 pr-3">{m.unit || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex justify-end pt-3">
        <button
          type="button"
          className="px-3 py-2 text-sm border rounded"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </AnimatedModal>
  );
}

// L10 Meeting Component
function L10MeetingPanel({
  meeting,
  seats,
  onUpdateMeeting,
  onStartRecording,
  onStopRecording,
  onOpenRecordingSuite,
}: {
  meeting: L10Meeting;
  seats: SeatNode[];
  onUpdateMeeting: (meeting: L10Meeting) => void;
  onStartRecording: (itemId?: string) => void;
  onStopRecording: () => void;
  onOpenRecordingSuite: () => void;
}) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Wrap start/stop to synchronize local state
  const startRecordingWrapped = useCallback(
    (itemId?: string) => {
      setIsRecording(true);
      onStartRecording(itemId);
    },
    [onStartRecording],
  );
  const stopRecordingWrapped = useCallback(() => {
    setIsRecording(false);
    onStopRecording();
  }, [onStopRecording]);

  // Sync AC data to L10
  const syncACData = useCallback(() => {
    if (!seats || seats.length === 0) return;

    // Collect all issues from AC seats
    const acIssues: L10Issue[] = [];
    const collectIssues = (node: SeatNode) => {
      if (node.eos?.issues) {
        node.eos.issues.forEach((issue) => {
          acIssues.push({
            id: issue.id,
            title: issue.title,
            description: `From ${node.name}`,
            priority: 'medium',
            status: issue.status === 'open' ? 'identified' : 'solved',
            owner: node.id,
          });
        });
      }
      node.children.forEach(collectIssues);
    };
    seats.forEach(collectIssues);

    // Update meeting with synced issues
    const existingIssueIds = meeting.issues.map((i) => i.id);
    const newIssues = acIssues.filter((i) => !existingIssueIds.includes(i.id));

    if (newIssues.length > 0) {
      onUpdateMeeting({
        ...meeting,
        issues: [...meeting.issues, ...newIssues],
      });
    }
  }, [seats, meeting, onUpdateMeeting]);

  // Sync on mount and when seats change
  useEffect(() => {
    syncACData();
  }, [seats]);

  // Default agenda items
  const defaultAgenda: L10AgendaItem[] = [
    {
      id: 'segue',
      type: 'segue',
      title: 'Segue - Good News',
      duration: 5,
      completed: false,
    },
    {
      id: 'scorecard',
      type: 'scorecard',
      title: 'Scorecard Review',
      duration: 5,
      completed: false,
    },
    {
      id: 'rocks',
      type: 'rocks',
      title: 'Rock Review',
      duration: 5,
      completed: false,
    },
    {
      id: 'headlines',
      type: 'headlines',
      title: 'Customer/Employee Headlines',
      duration: 5,
      completed: false,
    },
    {
      id: 'todo',
      type: 'todo',
      title: 'To-Do List Review',
      duration: 5,
      completed: false,
    },
    {
      id: 'ids',
      type: 'ids',
      title: 'IDS (Identify, Discuss, Solve)',
      duration: 60,
      completed: false,
    },
    {
      id: 'conclusion',
      type: 'conclusion',
      title: 'Conclusion',
      duration: 5,
      completed: false,
    },
  ];

  useEffect(() => {
    if (!meeting.agenda || meeting.agenda.length === 0) {
      onUpdateMeeting({
        ...meeting,
        agenda: defaultAgenda,
      });
    }
  }, []);

  useEffect(() => {
    if (activeItemId) {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else if (!activeItemId && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsedTime(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeItemId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartAgendaItem = (itemId: string) => {
    setActiveItemId(itemId);
    const updatedAgenda = meeting.agenda.map((item) => ({
      ...item,
      startTime: item.id === itemId ? Date.now() : item.startTime,
    }));
    onUpdateMeeting({ ...meeting, agenda: updatedAgenda });
    onStartRecording(itemId);
  };

  const handleCompleteAgendaItem = (itemId: string) => {
    const updatedAgenda = meeting.agenda.map((item) =>
      item.id === itemId ? { ...item, completed: true } : item,
    );
    onUpdateMeeting({ ...meeting, agenda: updatedAgenda });
    setActiveItemId(null);
  };

  const handleAddIssue = (issue: Omit<L10Issue, 'id'>) => {
    const newIssue: L10Issue = {
      ...issue,
      id: generateId(),
    };
    onUpdateMeeting({
      ...meeting,
      issues: [...meeting.issues, newIssue],
    });
  };

  const handleAddTodo = (todo: Omit<L10ToDo, 'id'>) => {
    const newTodo: L10ToDo = {
      ...todo,
      id: generateId(),
      fromMeeting: meeting.date,
    };
    onUpdateMeeting({
      ...meeting,
      todos: [...meeting.todos, newTodo],
    });
  };

  const getSeatName = (seatId: string): string => {
    const findSeat = (node: SeatNode): SeatNode | null => {
      if (node.id === seatId) return node;
      for (const child of node.children) {
        const found = findSeat(child);
        if (found) return found;
      }
      return null;
    };
    for (const seat of seats) {
      const found = findSeat(seat);
      if (found) return found.name;
    }
    return 'Unknown';
  };

  const scheduleNextL10 = useCallback(async () => {
    try {
      const base = new Date(meeting.date || Date.now());
      // Next week same weekday at 10:00, 90 minutes
      const weekday = new Date(meeting.date || Date.now()).getDay();
      const today = new Date();
      const daysUntil = ((weekday - today.getDay() + 7) % 7) + 7; // push to next week
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + daysUntil,
        10,
        0,
        0,
      );
      const end = new Date(start.getTime() + 90 * 60000);
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: 'Level 10 Meeting',
          description: 'EOS L10 – auto scheduled from Accountability composer',
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create event');
      }
      const data = await res.json();
      toast.success('Next L10 scheduled');
      if (data?.htmlLink) {
        try {
          window.open(data.htmlLink, '_blank');
        } catch (_) {}
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to schedule');
    }
  }, [meeting.date]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          L10 Meeting - {new Date(meeting.date).toLocaleDateString()}
        </h3>
        <button
          type="button"
          onClick={scheduleNextL10}
          className="text-xs px-2 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Create next L10"
        >
          <CalendarIcon className="w-3.5 h-3.5 inline-block mr-1" />
          Create next L10
        </button>
      </div>
      {/* existing panel content below */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            L10 Meeting - {new Date(meeting.date).toLocaleDateString()}
          </h3>
          <div className="flex items-center gap-4">
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                Recording
              </Badge>
            )}
            <Button
              size="sm"
              variant={isRecording ? 'destructive' : 'default'}
              onClick={() =>
                isRecording ? stopRecordingWrapped() : startRecordingWrapped()
              }
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Scorecard Summary - Shows rocks and measurables from AC */}
        {activeItemId === 'scorecard' && (
          <div className="space-y-3 mb-6 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              Scorecard Summary
            </h4>
            <div className="space-y-4">
              {/* Rocks Summary */}
              <div>
                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Rocks This Quarter
                </h5>
                <div className="space-y-1">
                  {seats
                    .flatMap((seat) => {
                      const allSeats: SeatNode[] = [];
                      const collectSeats = (node: SeatNode) => {
                        allSeats.push(node);
                        node.children.forEach(collectSeats);
                      };
                      collectSeats(seat);
                      return allSeats;
                    })
                    .flatMap((seat) =>
                      (seat.eos?.rocks || []).map((rock) => (
                        <div
                          key={rock.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {rock.title} ({seat.name})
                          </span>
                          <Badge
                            variant={
                              rock.status === 'done'
                                ? 'default'
                                : rock.status === 'onTrack'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="text-xs"
                          >
                            {rock.status}
                          </Badge>
                        </div>
                      )),
                    )}
                </div>
              </div>

              {/* People Analyzer Summary */}
              <div>
                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  People Analyzer (GWC)
                </h5>
                <div className="space-y-1">
                  {seats
                    .flatMap((seat) => {
                      const allSeats: SeatNode[] = [];
                      const collectSeats = (node: SeatNode) => {
                        allSeats.push(node);
                        node.children.forEach(collectSeats);
                      };
                      collectSeats(seat);
                      return allSeats;
                    })
                    .map((seat) => {
                      const gwc = seat.eos?.gwc;
                      if (!gwc) return null;
                      const hasIssue =
                        !gwc.getsIt || !gwc.wantsIt || !gwc.capacity;
                      if (!hasIssue) return null;

                      return (
                        <div
                          key={seat.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {seat.name} - {seat.holder || 'Empty'}
                          </span>
                          <div className="flex gap-1">
                            <Badge
                              variant={gwc.getsIt ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              G{gwc.getsIt ? '✓' : '✗'}
                            </Badge>
                            <Badge
                              variant={gwc.wantsIt ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              W{gwc.wantsIt ? '✓' : '✗'}
                            </Badge>
                            <Badge
                              variant={gwc.capacity ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              C{gwc.capacity ? '✓' : '✗'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agenda Items */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
            Meeting Agenda
          </h4>
          <div className="space-y-2">
            {meeting.agenda.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-all',
                  activeItemId === item.id
                    ? 'bg-eos-orange/10 border-eos-orange'
                    : item.completed
                      ? 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
                      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 hover:border-gray-300',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                      item.completed
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        : activeItemId === item.id
                          ? 'bg-eos-orange text-white'
                          : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400',
                    )}
                  >
                    {item.completed ? '✓' : item.duration}
                  </div>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    {activeItemId === item.id && (
                      <div className="text-sm text-eos-orange">
                        {formatTime(elapsedTime)} / {item.duration}:00
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.recordingId && (
                    <FileAudio className="w-4 h-4 text-gray-400" />
                  )}
                  {!item.completed && activeItemId !== item.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartAgendaItem(item.id)}
                    >
                      Start
                    </Button>
                  )}
                  {activeItemId === item.id && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleCompleteAgendaItem(item.id)}
                    >
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Issues Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              Issues List
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowIssueModal(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Issue
            </Button>
          </div>
          <div className="space-y-2">
            {meeting.issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      issue.priority === 'high'
                        ? 'bg-red-500'
                        : issue.priority === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-green-500',
                    )}
                  />
                  <div>
                    <div className="font-medium">{issue.title}</div>
                    {issue.owner && (
                      <div className="text-sm text-gray-500">
                        Owner: {getSeatName(issue.owner)}
                      </div>
                    )}
                  </div>
                </div>
                <Badge
                  variant={
                    issue.status === 'solved'
                      ? 'default'
                      : issue.status === 'discussing'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {issue.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* To-Dos Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              To-Do List
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTodoModal(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add To-Do
            </Button>
          </div>
          <div className="space-y-2">
            {meeting.todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={(e) => {
                      const updatedTodos = meeting.todos.map((t) =>
                        t.id === todo.id
                          ? { ...t, completed: e.target.checked }
                          : t,
                      );
                      onUpdateMeeting({ ...meeting, todos: updatedTodos });
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <div
                      className={cn(
                        'font-medium',
                        todo.completed && 'line-through opacity-50',
                      )}
                    >
                      {todo.task}
                    </div>
                    <div className="text-sm text-gray-500">
                      {getSeatName(todo.owner)}
                      {todo.dueDate &&
                        ` • Due: ${new Date(todo.dueDate).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meeting Rating */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              Meeting Rating
            </h4>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <button
                  type="button"
                  key={rating}
                  onClick={() => onUpdateMeeting({ ...meeting, rating })}
                  className={cn(
                    'w-8 h-8 rounded-full text-sm font-medium transition-all',
                    meeting.rating === rating
                      ? 'bg-eos-orange text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700',
                  )}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modals */}
        {showIssueModal && (
          <AddIssueModal
            seats={seats}
            onAdd={handleAddIssue}
            onClose={() => setShowIssueModal(false)}
          />
        )}
        {showTodoModal && (
          <AddTodoModal
            seats={seats}
            onAdd={handleAddTodo}
            onClose={() => setShowTodoModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// Add Issue Modal
function AddIssueModal({
  seats,
  onAdd,
  onClose,
}: {
  seats: SeatNode[];
  onAdd: (issue: Omit<L10Issue, 'id'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<L10Issue['priority']>('medium');
  const [owner, setOwner] = useState('');

  const getAllSeats = (node: SeatNode): SeatNode[] => {
    return [node, ...node.children.flatMap(getAllSeats)];
  };

  const allSeats = seats.flatMap(getAllSeats);

  const handleSubmit = () => {
    if (title.trim()) {
      onAdd({
        title,
        description,
        priority,
        owner: owner || undefined,
        status: 'identified',
      });
      onClose();
    }
  };

  return (
    <AnimatedModal isOpen={true} onClose={onClose} title="Add Issue" size="md">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="issue-title"
            className="block text-sm font-medium mb-1"
          >
            Issue Title
          </label>
          <input
            id="issue-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter issue title"
            autoFocus
          />
        </div>
        <div>
          <label
            htmlFor="issue-description"
            className="block text-sm font-medium mb-1"
          >
            Description
          </label>
          <textarea
            id="issue-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            rows={3}
            placeholder="Enter issue description (optional)"
          />
        </div>
        <div>
          <label
            htmlFor="issue-priority"
            className="block text-sm font-medium mb-1"
          >
            Priority
          </label>
          <select
            id="issue-priority"
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as L10Issue['priority'])
            }
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="issue-owner"
            className="block text-sm font-medium mb-1"
          >
            Owner
          </label>
          <select
            id="issue-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">Select owner...</option>
            {allSeats.map((seat) => (
              <option key={seat.id} value={seat.id}>
                {seat.name} {seat.holder && `(${seat.holder})`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!title.trim()}>
          Add Issue
        </Button>
      </div>
    </AnimatedModal>
  );
}

// Add To-Do Modal
function AddTodoModal({
  seats,
  onAdd,
  onClose,
}: {
  seats: SeatNode[];
  onAdd: (todo: Omit<L10ToDo, 'id' | 'fromMeeting'>) => void;
  onClose: () => void;
}) {
  const [task, setTask] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');

  const getAllSeats = (node: SeatNode): SeatNode[] => {
    return [node, ...node.children.flatMap(getAllSeats)];
  };

  const allSeats = seats.flatMap(getAllSeats);

  const handleSubmit = () => {
    if (task.trim() && owner) {
      onAdd({
        task,
        owner,
        dueDate: dueDate || undefined,
        completed: false,
      });
      onClose();
    }
  };

  return (
    <AnimatedModal isOpen={true} onClose={onClose} title="Add To-Do" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="todo-task" className="block text-sm font-medium mb-1">
            Task
          </label>
          <input
            id="todo-task"
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter task description"
            autoFocus
          />
        </div>
        <div>
          <label
            htmlFor="todo-owner"
            className="block text-sm font-medium mb-1"
          >
            Owner
          </label>
          <select
            id="todo-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">Select owner...</option>
            {allSeats.map((seat) => (
              <option key={seat.id} value={seat.id}>
                {seat.name} {seat.holder && `(${seat.holder})`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="todo-due-date"
            className="block text-sm font-medium mb-1"
          >
            Due Date
          </label>
          <input
            id="todo-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!task.trim() || !owner}>
          Add To-Do
        </Button>
      </div>
    </AnimatedModal>
  );
}

export const accountabilityComposer = new Composer<'accountability', Metadata>({
  kind: 'accountability',
  description:
    'Build an EOS Accountability Chart with hierarchical seats, roles, and seat holders',
  initialize: async ({ setMetadata, documentId }) => {
    const composerId = documentId || generateId();
    setMetadata({
      ac: null,
      acLayout: {},
      layoutMode: 'balanced',
      selectedQuarter: getCurrentQuarterString(),
      l10Enabled: false,
      l10Meetings: [],
      activeMeetingId: undefined,
      composerId,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setComposer }) => {
    console.log('[AC Debug] onStreamPart called:', streamPart);
    if (streamPart.type === 'text-delta') {
      const text = String(streamPart.content || '');
      console.log('[AC Debug] Received text-delta:', text);
      setComposer((draft) => {
        const newContent = draft.content + text;

        // Try to parse accumulated content
        const parsed = parseACFromContent(newContent);
        if (parsed) {
          console.log('[AC Debug] Successfully parsed AC:', parsed);
          setMetadata((m: Metadata) => ({ ...(m || {}), ac: parsed }));
        }

        return {
          ...draft,
          // Sync composer.title to JSON title if present
          title:
            parsed?.title && parsed.title !== draft.title
              ? (parsed.title as string)
              : draft.title,
          content: newContent,
          isVisible:
            draft.status === 'streaming' && newContent.length > 120
              ? true
              : draft.isVisible,
          status: 'streaming',
        };
      });
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
    console.log('[AC Debug] Content component rendered:', {
      content,
      metadata,
      title,
      status,
    });
    const previewRef = useRef<HTMLDivElement>(null);
    const lastValidRef = useRef<AccountabilityChartData | null>(null);

    useEffect(() => {
      const parsed = parseACFromContent(content);
      if (parsed) lastValidRef.current = parsed;
    }, [content]);

    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [localAc, setLocalAc] = useState<AccountabilityChartData | null>(
      null,
    );
    const [positionsById, setPositionsById] = useState<
      Record<string, { x: number; y: number }>
    >(
      () =>
        (metadata?.acLayout as Record<string, { x: number; y: number }>) || {},
    );
    const layoutMode: 'balanced' | 'manual' =
      (metadata?.layoutMode as any) || 'balanced';

    const acSource: AccountabilityChartData | null = useMemo(() => {
      if (localAc) return normalizeChart(localAc);
      if (metadata?.ac)
        return normalizeChart(metadata.ac as AccountabilityChartData);
      const parsed = parseACFromContent(content);
      if (parsed) return normalizeChart(parsed);
      if (lastValidRef.current) return normalizeChart(lastValidRef.current);
      return null;
    }, [localAc, metadata?.ac, content]);

    const ac: AccountabilityChartData = useMemo(() => {
      return (
        acSource || {
          version: 1,
          title: title || 'Accountability Chart',
          root: {
            id: generateId(),
            name: 'Root',
            holder: '',
            roles: [],
            accent: '#3b82f6',
            children: [],
          },
        }
      );
    }, [acSource, title]);

    const hasParsedContent = useMemo(() => acSource !== null, [acSource]);

    const setAC = (next: AccountabilityChartData) => {
      const normalized = normalizeChart(next);
      // Update metadata immediately for UI
      setMetadata((m: Metadata | null) => ({ ...(m || {}), ac: normalized }));
      setLocalAc(normalized);
      // Force graph update by incrementing version
      setGraphVersion((v) => v + 1);
      // Persist to content stream
      const json = JSON.stringify(normalized, null, 2);
      const wrapped = `AC_DATA_BEGIN\n${json}\nAC_DATA_END`;
      // Defer save to the next tick to avoid cross-component update during render
      setTimeout(() => onSaveContent(wrapped, true), 0);
    };

    // Track if we've loaded the initial content
    const [hasLoadedContent, setHasLoadedContent] = useState(false);

    useEffect(() => {
      if (content && !hasLoadedContent) {
        setHasLoadedContent(true);
      }
    }, [content, hasLoadedContent]);

    // Note: persistence handled in setAC; avoid duplicate auto-save here

    const exportPng = async () => {
      try {
        const [{ default: html2canvas }] = await Promise.all([
          import('html2canvas'),
        ]);
        const node = previewRef.current;
        if (!node) return;
        const canvas = await html2canvas(node as HTMLElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
        });
        const imgData = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        const safe = (ac.title || title || 'accountability-chart')
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase();
        a.href = imgData;
        a.download = `${safe}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Downloaded Accountability Chart as PNG');
      } catch (e) {
        console.error(e);
        toast.error('Failed to export PNG');
      }
    };

    // Custom node component for EOS-style seats (defined outside to use hooks)
    const SeatFlowNode = React.memo(({ data }: { data: any }) => {
      const {
        seat,
        onEdit,
        onAddChild,
        onRemove,
        onMoveLeft,
        onMoveRight,
        onPromote,
        onToRoot,
        isRoot,
        onOpenMenu,
        selectedQuarter,
        onOpenPeopleAnalyzer,
        onOpenRocks,
        onOpenMeasurables,
        onOpenProcesses,
        onOpenIssues,
      } = data;
      const [menuOpen, setMenuOpen] = useState(false);
      const menuRef = useRef<HTMLDivElement | null>(null);
      const menuButtonRef = useRef<HTMLButtonElement | null>(null);
      const flashKey = dropFlashById[seat.id] || 0;

      useEffect(() => {
        if (!menuOpen) return;
        const handlePointerDown = (ev: PointerEvent) => {
          const target = ev.target as Node | null;
          if (menuRef.current && target && menuRef.current.contains(target))
            return;
          if (
            menuButtonRef.current &&
            target &&
            menuButtonRef.current.contains(target)
          )
            return;
          try {
            onOpenMenu?.();
          } catch {}
          setMenuOpen(false);
        };
        const handleKeyDown = (ev: KeyboardEvent) => {
          if (ev.key === 'Escape') {
            try {
              onOpenMenu?.();
            } catch {}
            setMenuOpen(false);
          }
        };
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
          document.removeEventListener('pointerdown', handlePointerDown, true);
          document.removeEventListener('keydown', handleKeyDown, true);
        };
      }, [menuOpen, onOpenMenu]);

      const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('[AC] Edit clicked for seat:', seat);
        if (onEdit) onEdit(seat);
      };

      const handleAddChild = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('[AC] Add child clicked for seat:', seat);
        if (onAddChild) onAddChild(seat);
      };

      return (
        <div className="relative group" style={{ cursor: 'grab' }}>
          {/* React Flow connection handles */}
          <Handle
            id="top"
            type="target"
            position={Position.Top}
            style={{
              background: '#64748b',
              width: 8,
              height: 8,
              border: '2px solid #fff',
              top: -4,
            }}
          />
          <Handle
            id="bottom"
            type="source"
            position={Position.Bottom}
            style={{
              background: '#64748b',
              width: 8,
              height: 8,
              border: '2px solid #fff',
              bottom: -4,
            }}
          />
          <div
            className={`transition-all relative text-foreground bg-white dark:bg-zinc-900 rounded-xl border-2 shadow-lg hover:shadow-xl ${
              flashKey > 0 ? 'ac-drop-flash' : ''
            }`}
            style={{
              borderColor: seat.accent || '#3b82f6',
              minWidth: '280px',
              maxWidth: '320px',
              backgroundColor: isRoot
                ? seat.accent
                  ? `${seat.accent}08`
                  : '#3b82f608'
                : undefined,
            }}
            role="article"
            data-nodeid={seat.id}
          >
            {/* Edge highlight overlays */}
            {highlightMap[seat.id] && (
              <div className="pointer-events-none absolute inset-0">
                {highlightMap[seat.id] === 'top' && (
                  <div className="absolute top-0 left-0 right-0 h-2 bg-blue-400/60 animate-pulse" />
                )}
                {highlightMap[seat.id] === 'bottom' && (
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-blue-400/60 animate-pulse" />
                )}
                {highlightMap[seat.id] === 'left' && (
                  <div className="absolute top-0 bottom-0 left-0 w-2 bg-blue-400/60 animate-pulse" />
                )}
                {highlightMap[seat.id] === 'right' && (
                  <div className="absolute top-0 bottom-0 right-0 w-2 bg-blue-400/60 animate-pulse" />
                )}
              </div>
            )}
            <div
              className="px-4 py-3 border-b-2 text-foreground"
              style={{
                borderColor: seat.accent || '#3b82f6',
                backgroundColor: seat.accent ? `${seat.accent}10` : '#3b82f610',
              }}
            >
              <div
                className="font-bold text-sm uppercase tracking-wide"
                style={{ color: seat.accent || '#3b82f6' }}
              >
                {seat.name}
              </div>
            </div>
            <div className="px-4 py-3 text-foreground">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {seat.holder || 'Seat Holder'}
                </div>
              </div>
              {seat.roles && seat.roles.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-zinc-300 uppercase tracking-wide">
                    Roles
                  </div>
                  <div className="text-xs text-gray-700 dark:text-zinc-200 space-y-0.5">
                    {seat.roles.map((role: string, idx: number) => (
                      <div
                        key={`${seat.id}-role-${idx}`}
                        className="flex items-start"
                      >
                        <span className="mr-1">•</span>
                        <span>{role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* EOS badges row */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {/* GWC tri-indicator */}
                {seat.eos?.gwc && (
                  <button
                    type="button"
                    className="px-2 py-1 text-[10px] rounded-full border bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700"
                    title="People Analyzer (GWC)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPeopleAnalyzer?.(seat);
                    }}
                  >
                    G:{seat.eos.gwc.getsIt ? '✓' : '–'} W:
                    {seat.eos.gwc.wantsIt ? '✓' : '–'} C:
                    {seat.eos.gwc.capacity ? '✓' : '–'}
                  </button>
                )}
                {/* Rocks count badge for selected quarter */}
                {Array.isArray(seat.eos?.rocks) &&
                  seat.eos?.rocks.length > 0 && (
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] rounded-full border bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700"
                      title={`Rocks in ${selectedQuarter}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRocks?.(seat);
                      }}
                    >
                      Rocks {selectedQuarter}:{' '}
                      {
                        seat.eos.rocks.filter(
                          (r: { quarter: string }) =>
                            r.quarter === selectedQuarter,
                        ).length
                      }
                    </button>
                  )}
                {/* Measurables quick badge */}
                {Array.isArray(seat.eos?.measurables) &&
                  seat.eos?.measurables.length > 0 && (
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] rounded-full border bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700"
                      title="Open Measurables"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMeasurables?.(seat);
                      }}
                    >
                      Measurables: {seat.eos.measurables.length}
                    </button>
                  )}
                {/* Issues bubble */}
                {(typeof seat.eos?.issuesCount === 'number' ||
                  Array.isArray(seat.eos?.issues)) && (
                  <button
                    type="button"
                    className="px-2 py-1 text-[10px] rounded-full border bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700"
                    title="Open Issues"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenIssues?.(seat);
                    }}
                  >
                    Issues:{' '}
                    {Array.isArray(seat.eos?.issues)
                      ? seat.eos?.issues.filter(
                          (i: { status: 'open' | 'solved' }) =>
                            i.status === 'open',
                        ).length
                      : seat.eos?.issuesCount || 0}
                  </button>
                )}
                {/* Docs icon */}
                {Array.isArray(seat.eos?.processes) &&
                  seat.eos?.processes.length > 0 && (
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] rounded-full border bg-white hover:bg-gray-50"
                      title="Open Processes"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProcesses?.(seat);
                      }}
                    >
                      Processes: {seat.eos.processes.length}
                    </button>
                  )}
              </div>
            </div>

            {/* Action buttons - consolidated */}
            <div className="absolute top-2 right-2 flex gap-2 z-[500] opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={handleEdit}
                className="w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg bg-eos-orange text-white border-2 border-white dark:border-zinc-800"
                title="Edit seat"
              >
                <svg
                  className="w-7 h-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.25}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={handleAddChild}
                className="w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg bg-eos-navy text-white border-2 border-white dark:border-zinc-800"
                title="Add seat below"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </button>
              {!isRoot && (
                <>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Mark to ignore the next drag-stop caused by this click
                      try {
                        onOpenMenu?.();
                      } catch {}
                      setMenuOpen((o) => !o);
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    draggable={false}
                    className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 hover:shadow-xl text-white border-2 border-white dark:border-zinc-700"
                    style={{
                      backgroundColor: 'rgb(63, 63, 70)',
                      opacity: '1',
                    }}
                    title="More actions"
                    ref={menuButtonRef}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.75a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 8.25a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 8.25a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                      />
                    </svg>
                  </button>
                  {menuOpen && (
                    <div
                      className="absolute top-12 right-0 border-2 border-gray-200 dark:border-zinc-700 rounded-lg shadow-2xl z-[200] w-48 py-2 text-zinc-900 dark:text-zinc-100"
                      style={{
                        backgroundColor:
                          document.documentElement.classList.contains('dark')
                            ? 'rgb(24, 24, 27)'
                            : 'rgb(255, 255, 255)',
                        backdropFilter: 'none !important',
                        WebkitBackdropFilter: 'none !important',
                        opacity: '1',
                      }}
                      role="menu"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      ref={menuRef}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onMoveLeft?.(seat);
                        }}
                      >
                        Move left
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onMoveRight?.(seat);
                        }}
                      >
                        Move right
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onPromote?.(seat);
                        }}
                      >
                        Promote
                      </button>
                      <div className="my-1 h-px bg-gray-100 dark:bg-zinc-700" />
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onOpenPeopleAnalyzer?.(seat);
                        }}
                      >
                        People Analyzer
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onOpenRocks?.(seat);
                        }}
                      >
                        Assign/View Rocks
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onOpenMeasurables?.(seat);
                        }}
                      >
                        Add Measurable
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onOpenProcesses?.(seat);
                        }}
                      >
                        Open Processes
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onOpenIssues?.(seat);
                        }}
                      >
                        Add/View Issues (L10)
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onToRoot?.(seat);
                        }}
                      >
                        Move to root
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onRemove?.(seat);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      );
    });

    // Define nodeTypes with memoization
    const nodeTypes = useMemo(() => ({ seat: SeatFlowNode }), []);

    // EOS state and openers used by node data and header controls
    const selectedQuarter: string = useMemo(
      () =>
        ((metadata as any)?.selectedQuarter as string) ||
        getCurrentQuarterString(),
      [metadata],
    );
    const setSelectedQuarter = useCallback(
      (q: string) =>
        setMetadata((m: Metadata) => ({
          ...(m as Metadata),
          selectedQuarter: q,
        })),
      [setMetadata],
    );
    const l10Enabled = (metadata as Metadata)?.l10Enabled || false;
    const l10Meetings = (metadata as Metadata)?.l10Meetings || [];
    const activeMeetingId = (metadata as Metadata)?.activeMeetingId;
    const activeMeeting = l10Meetings.find((m) => m.id === activeMeetingId);

    const composerId = (metadata as Metadata)?.composerId;
    const l10Recording = (metadata as Metadata)?.l10Recording;
    const isSessionRecording = !!l10Recording?.active;
    const currentRecordingItemId = l10Recording?.currentItemId;

    const startNewL10Meeting = useCallback(async () => {
      if (!composerId) {
        console.error('No composer ID found');
        return;
      }

      try {
        // Create meeting in database
        const requestBody = {
          composerId,
          title: `L10 Meeting - ${new Date().toLocaleDateString()}`,
          attendees: [],
        };
        console.log('Creating L10 meeting with:', requestBody);

        const response = await fetch('/api/l10', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('L10 creation failed:', response.status, errorData);
          console.error('Error details:', errorData.details);
          console.error('Error code:', errorData.code);
          throw new Error(
            errorData.error ||
              `Failed to create L10 meeting: ${response.status}`,
          );
        }

        const { meeting } = await response.json();

        // Update local state
        setMetadata((m: Metadata) => ({
          ...(m as Metadata),
          l10Enabled: true,
          l10Meetings: [...(m?.l10Meetings || []), meeting],
          activeMeetingId: meeting.id,
        }));

        toast.success('L10 Meeting started');
      } catch (error) {
        console.error('Error creating L10 meeting:', error);
        toast.error('Failed to start L10 meeting');
      }
    }, [setMetadata, composerId]);

    const setActiveMeeting = useCallback(
      (meetingId: string | null) => {
        setMetadata((m: Metadata) => ({
          ...(m as Metadata),
          activeMeetingId: meetingId || undefined,
        }));
      },
      [setMetadata],
    );
    const openPeopleAnalyzer = useCallback(
      (seat: SeatNode) => setPeopleAnalyzerSeat(seat),
      [],
    );
    const openRocks = useCallback((seat: SeatNode) => setRocksSeat(seat), []);
    const openMeasurables = useCallback(
      (seat: SeatNode) => setMeasurablesSeat(seat),
      [],
    );
    const openProcesses = useCallback(
      (seat: SeatNode) => setProcessesSeat(seat),
      [],
    );
    const openIssues = useCallback((seat: SeatNode) => setIssuesSeat(seat), []);

    // Convert tree to nodes/edges with improved balanced layout
    const toGraph = useCallback(
      (
        root: SeatNode,
        onEdit: (seat: SeatNode) => void,
        onAddChild: (seat: SeatNode) => void,
        onRemove: (seat: SeatNode) => void,
      ) => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Unified layout spacing
        const nodeUnitWidth = 380; // width per leaf span (node width + gutter)
        const verticalGap = 300; // vertical distance between levels
        const topOffset = 120; // top padding for the first level
        const leftPadding = 40; // small left padding for the whole layout

        // Manual layout uses saved positions
        if (layoutMode === 'manual') {
          const walkManual = (node: SeatNode, depth = 0) => {
            nodes.push({
              id: node.id,
              type: 'seat',
              data: {
                seat: node,
                onEdit,
                onAddChild,
                onRemove,
                onMoveLeft: (s: SeatNode) => handleMoveLeft(s),
                onMoveRight: (s: SeatNode) => handleMoveRight(s),
                onPromote: (s: SeatNode) => handlePromote(s),
                onToRoot: (s: SeatNode) => handleMoveToRoot(s),
                isRoot: depth === 0,
                selectedQuarter,
                onOpenPeopleAnalyzer: (s: SeatNode) => openPeopleAnalyzer(s),
                onOpenRocks: (s: SeatNode) => openRocks(s),
                onOpenMeasurables: (s: SeatNode) => openMeasurables(s),
                onOpenProcesses: (s: SeatNode) => openProcesses(s),
                onOpenIssues: (s: SeatNode) => openIssues(s),
              },
              position: positionsById[node.id] || {
                x: 0,
                y: depth * verticalGap + topOffset,
              },
              sourcePosition: Position.Bottom,
              targetPosition: Position.Top,
            });
            node.children.forEach((child) => {
              edges.push({
                id: `e-${node.id}-to-${child.id}`,
                source: node.id,
                target: child.id,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#64748b',
                  strokeWidth: 2.5,
                  strokeDasharray:
                    depth === 0 ? '0' : depth === 1 ? '5,5' : '2,2',
                },
                markerEnd: {
                  type: 'arrowclosed' as const,
                  color: '#64748b',
                  width: 20,
                  height: 20,
                },
              });
              walkManual(child, depth + 1);
            });
          };
          walkManual(root);
          return { nodes, edges };
        }

        // Balanced layout that accounts for subtree sizes
        const leafSpanCache = new Map<string, number>();
        const getLeafSpan = (node: SeatNode): number => {
          if (leafSpanCache.has(node.id)) {
            const cached = leafSpanCache.get(node.id);
            return typeof cached === 'number' ? cached : 1;
          }
          if (!node.children || node.children.length === 0) {
            leafSpanCache.set(node.id, 1);
            return 1;
          }
          const span = node.children.reduce(
            (sum, c) => sum + getLeafSpan(c),
            0,
          );
          leafSpanCache.set(node.id, Math.max(1, span));
          return Math.max(1, span);
        };

        const unitWidth = nodeUnitWidth; // approximate node width including gutter
        const gapY = verticalGap;

        const place = (
          node: SeatNode,
          depth: number,
          leftX: number,
        ): number => {
          const span = getLeafSpan(node);
          const width = span * unitWidth;
          const x = leftX + width / 2;
          const y = depth * gapY + topOffset;
          nodes.push({
            id: node.id,
            type: 'seat',
            data: {
              seat: node,
              onEdit,
              onAddChild,
              onRemove,
              onMoveLeft: (s: SeatNode) => handleMoveLeft(s),
              onMoveRight: (s: SeatNode) => handleMoveRight(s),
              onPromote: (s: SeatNode) => handlePromote(s),
              onToRoot: (s: SeatNode) => handleMoveToRoot(s),
              isRoot: depth === 0,
              selectedQuarter,
              onOpenPeopleAnalyzer: (s: SeatNode) => openPeopleAnalyzer(s),
              onOpenRocks: (s: SeatNode) => openRocks(s),
              onOpenMeasurables: (s: SeatNode) => openMeasurables(s),
              onOpenProcesses: (s: SeatNode) => openProcesses(s),
              onOpenIssues: (s: SeatNode) => openIssues(s),
            },
            position: { x, y },
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
          });

          if (node.children && node.children.length > 0) {
            let cursor = leftX;
            node.children.forEach((child) => {
              // edge
              edges.push({
                id: `e-${node.id}-to-${child.id}`,
                source: node.id,
                target: child.id,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#64748b',
                  strokeWidth: 2.5,
                  strokeDasharray:
                    depth === 0 ? '0' : depth === 1 ? '5,5' : '2,2',
                },
                markerEnd: {
                  type: 'arrowclosed' as const,
                  color: '#64748b',
                  width: 20,
                  height: 20,
                },
              });
              const childSpan = getLeafSpan(child);
              const childWidth = childSpan * unitWidth;
              place(child, depth + 1, cursor);
              cursor += childWidth;
            });
          }
          return width;
        };

        const totalWidth = place(root, 0, leftPadding);
        // Optionally center the whole graph by shifting positions by half width if needed
        // but ReactFlow will fit view; so we keep origin at 0.
        return { nodes, edges };
      },
      [
        positionsById,
        layoutMode,
        selectedQuarter,
        openPeopleAnalyzer,
        openRocks,
        openMeasurables,
        openProcesses,
        openIssues,
      ],
    );

    // Initialize with empty arrays
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [highlightMap, setHighlightMap] = useState<
      Record<string, 'top' | 'bottom' | 'left' | 'right' | null>
    >({});
    const [overlayRects, setOverlayRects] = useState<
      Record<
        string,
        { top: number; left: number; width: number; height: number }
      >
    >({});
    const [dropFlashById, setDropFlashById] = useState<Record<string, number>>(
      {},
    );

    // Recompute overlay rects from actual DOM node positions to account for pan/zoom transforms
    const updateOverlayRectsFromDOM = useCallback(() => {
      try {
        const container = previewRef.current;
        if (!container) return;
        const cRect = container.getBoundingClientRect();
        const nodeEls = Array.from(
          document.querySelectorAll('.react-flow__node'),
        ) as HTMLElement[];
        const next: Record<
          string,
          { top: number; left: number; width: number; height: number }
        > = {};
        nodeEls.forEach((el: HTMLElement) => {
          const id = el.getAttribute('data-id');
          if (!id) return;
          const r = el.getBoundingClientRect();
          next[id] = {
            top: r.top - cRect.top,
            left: r.left - cRect.left,
            width: r.width,
            height: r.height,
          };
        });
        setOverlayRects(next);
      } catch {}
    }, []);
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
      new Set(),
    );
    const [rf, setRf] = useState<any>(null);
    const [showAddSeatModal, setShowAddSeatModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSeat, setEditingSeat] = useState<SeatNode | null>(null);
    const [showRecordingModal, setShowRecordingModal] = useState(false);
    const [currentRecordingContext, setCurrentRecordingContext] = useState<{
      type: 'l10';
      itemId?: string;
    } | null>(null);

    // Load L10 meetings from database on mount
    useEffect(() => {
      if (composerId && l10Enabled) {
        fetch(`/api/l10?composerId=${composerId}`)
          .then((res) => res.json())
          .then(({ meetings }) => {
            if (meetings && meetings.length > 0) {
              setMetadata((m: Metadata) => ({
                ...(m as Metadata),
                l10Meetings: meetings,
              }));
            }
          })
          .catch((error) => {
            console.error('Error loading L10 meetings:', error);
          });
      }
    }, [composerId, l10Enabled]);

    const [peopleAnalyzerSeat, setPeopleAnalyzerSeat] =
      useState<SeatNode | null>(null);
    const [rocksSeat, setRocksSeat] = useState<SeatNode | null>(null);
    const [measurablesSeat, setMeasurablesSeat] = useState<SeatNode | null>(
      null,
    );
    const [processesSeat, setProcessesSeat] = useState<SeatNode | null>(null);
    const [issuesSeat, setIssuesSeat] = useState<SeatNode | null>(null);
    const [showScorecardModal, setShowScorecardModal] = useState(false);
    const [parentSeatId, setParentSeatId] = useState<string | null>(null);
    const [containerReady, setContainerReady] = useState(false);
    const [flowInitialized, setFlowInitialized] = useState(false);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const [graphVersion, setGraphVersion] = useState(0); // Track graph updates
    const [editMode, setEditMode] = useState(false);
    const ignoreNextDragStopRef = useRef(false);
    const markIgnoreNextDragStop = useCallback(() => {
      ignoreNextDragStopRef.current = true;
    }, []);
    // Suppress auto-fit while the user is dragging or just finished an interaction
    const suppressAutoFitRef = useRef(false);
    // Only auto-fit on first init or when explicitly requested
    const autoFitNextRef = useRef(true);

    // NOTE: EOS state and openers are defined above (once) to avoid redeclarations

    // Callbacks for node actions
    const handleEditSeat = useCallback((seat: SeatNode) => {
      setEditingSeat(seat);
      setShowEditModal(true);
    }, []);

    const handleAddChildSeat = useCallback((seat: SeatNode) => {
      setParentSeatId(seat.id);
      setShowAddSeatModal(true);
    }, []);

    const handleRemoveSeat = useCallback(
      (seat: SeatNode) => {
        if (!seat?.id) return;
        if (seat.id === ac.root.id) return;
        const updatedRoot = deleteFromTree(ac.root, seat.id);
        setAC({ ...ac, root: updatedRoot });
        toast.success('Seat removed');
      },
      [ac],
    );

    // Utilities for restructuring
    const findParentInfo = useCallback(
      (
        node: SeatNode,
        targetId: string,
        parent: SeatNode | null = null,
      ): { parent: SeatNode | null; index: number } | null => {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child.id === targetId) return { parent: node, index: i };
          const found = findParentInfo(child, targetId, node);
          if (found) return found;
        }
        return null;
      },
      [],
    );

    // Utility to seed manual positions from current ReactFlow nodes
    const seedManualPositionsFromRF = useCallback(() => {
      try {
        const rfNodes = rf?.getNodes?.() || [];
        if (!rfNodes || rfNodes.length === 0) return;
        const seeded: Record<string, { x: number; y: number }> = {};
        rfNodes.forEach((n: any) => {
          if (n?.id && n?.position) {
            seeded[n.id] = { x: n.position.x, y: n.position.y };
          }
        });
        setPositionsById(seeded);
        setMetadata((m: Metadata) => ({
          ...(m as Metadata),
          acLayout: seeded,
        }));
        setGraphVersion((v) => v + 1);
      } catch {}
    }, [rf, setPositionsById, setMetadata]);

    const extractSeat = useCallback(
      (
        root: SeatNode,
        seatId: string,
      ): { root: SeatNode; seat: SeatNode | null } => {
        let extracted: SeatNode | null = null;
        const walk = (n: SeatNode): SeatNode => ({
          ...n,
          children: n.children
            .filter((c) => {
              if (c.id === seatId) {
                extracted = c;
                return false;
              }
              return true;
            })
            .map(walk),
        });
        const pruned = walk(root);
        return { root: pruned, seat: extracted };
      },
      [],
    );

    const insertSeatAtIndex = useCallback(
      (
        root: SeatNode,
        parentId: string,
        seat: SeatNode,
        index: number,
      ): SeatNode => {
        return mapTree(
          root,
          (n) => n.id === parentId,
          (n) => {
            const nextChildren = [...n.children];
            const clampedIndex = Math.max(
              0,
              Math.min(index, nextChildren.length),
            );
            nextChildren.splice(clampedIndex, 0, seat);
            return { ...n, children: nextChildren };
          },
        );
      },
      [],
    );

    // Lookup helpers for drag validation
    function findSeatById(root: SeatNode, id: string): SeatNode | null {
      if (root.id === id) return root;
      for (const child of root.children) {
        const found = findSeatById(child, id);
        if (found) return found;
      }
      return null;
    }

    function isDescendant(
      root: SeatNode,
      ancestorId: string,
      descendantId: string,
    ): boolean {
      const ancestor = findSeatById(root, ancestorId);
      if (!ancestor) return false;
      const stack: SeatNode[] = [ancestor];
      while (stack.length) {
        const node = stack.pop() as SeatNode;
        if (node.id === descendantId) return true;
        for (const c of node.children) stack.push(c);
      }
      return false;
    }

    const handleMoveLeft = useCallback(
      (seat: SeatNode) => {
        const info = findParentInfo(ac.root, seat.id);
        if (!info || !info.parent) return;
        const { parent, index } = info;
        if (index <= 0) return;
        const { root: pruned, seat: extracted } = extractSeat(ac.root, seat.id);
        if (!extracted) return;
        const updatedRoot = insertSeatAtIndex(
          pruned,
          parent.id,
          extracted,
          index - 1,
        );
        setAC({ ...ac, root: updatedRoot });
      },
      [ac, extractSeat, findParentInfo, insertSeatAtIndex],
    );

    const handleMoveRight = useCallback(
      (seat: SeatNode) => {
        const info = findParentInfo(ac.root, seat.id);
        if (!info || !info.parent) return;
        const { parent, index } = info;
        const { root: pruned, seat: extracted } = extractSeat(ac.root, seat.id);
        if (!extracted) return;
        const updatedRoot = insertSeatAtIndex(
          pruned,
          parent.id,
          extracted,
          index + 1,
        );
        setAC({ ...ac, root: updatedRoot });
      },
      [ac, extractSeat, findParentInfo, insertSeatAtIndex],
    );

    const handlePromote = useCallback(
      (seat: SeatNode) => {
        const findPath = (
          n: SeatNode,
          target: string,
          path: SeatNode[] = [],
        ): SeatNode[] | null => {
          if (n.id === target) return [...path, n];
          for (const c of n.children) {
            const res = findPath(c, target, [...path, n]);
            if (res) return res;
          }
          return null;
        };
        const path = findPath(ac.root, seat.id);
        if (!path || path.length < 2) return;
        const parent = path[path.length - 2];
        const grandparent = path.length >= 3 ? path[path.length - 3] : null;
        if (!grandparent) return;
        const parentInfo = findParentInfo(ac.root, parent.id);
        if (!parentInfo || !parentInfo.parent) return;
        const { index: parentIndex } = parentInfo;
        const { root: pruned, seat: extracted } = extractSeat(ac.root, seat.id);
        if (!extracted) return;
        const updatedRoot = insertSeatAtIndex(
          pruned,
          grandparent.id,
          extracted,
          parentIndex + 1,
        );
        setAC({ ...ac, root: updatedRoot });
      },
      [ac, extractSeat, findParentInfo, insertSeatAtIndex],
    );

    const handleMoveToRoot = useCallback(
      (seat: SeatNode) => {
        if (seat.id === ac.root.id) return;
        const { root: pruned, seat: extracted } = extractSeat(ac.root, seat.id);
        if (!extracted) return;
        const updatedRoot = insertSeatAtIndex(
          pruned,
          ac.root.id,
          extracted,
          pruned.children.length,
        );
        setAC({ ...ac, root: updatedRoot });
      },
      [ac, extractSeat, insertSeatAtIndex],
    );

    // Generate graph data when ac.root changes
    const graphData = useMemo(() => {
      if (!hasParsedContent) return { nodes: [], edges: [] };
      const data = toGraph(
        ac.root,
        handleEditSeat,
        handleAddChildSeat,
        handleRemoveSeat,
      );
      console.log('[AC Debug] Graph data generated:', {
        nodes: data.nodes.map((n) => ({ id: n.id, position: n.position })),
        edges: data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
      });
      // Inject helper into each node's data to mark ignore for drag-stop when opening menus
      data.nodes = data.nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data || {}),
          onOpenMenu: markIgnoreNextDragStop,
        },
      }));
      return data;
    }, [
      hasParsedContent,
      ac.root,
      toGraph,
      handleEditSeat,
      handleAddChildSeat,
      handleRemoveSeat,
      graphVersion,
    ]);

    // Update nodes and edges when both container and flow are ready
    useEffect(() => {
      if (!containerReady || !flowInitialized || !rf) {
        return;
      }

      setNodes(graphData.nodes);
      setEdges(graphData.edges);

      // Only auto-fit when requested and not during user interaction
      if (autoFitNextRef.current && !suppressAutoFitRef.current) {
        try {
          rf.fitView({ padding: 0.2, duration: 200 });
        } catch {}
        autoFitNextRef.current = false;
      }
    }, [graphData, containerReady, flowInitialized, rf, setNodes, setEdges]);

    const onConnect = useCallback(
      (conn: Connection) =>
        setEdges((eds: Edge[]) => addEdge({ ...conn, type: 'bezier' }, eds)),
      [setEdges],
    );

    // Keyboard shortcuts: Enter=add sibling, Shift+Enter=add child, Tab promote/demote, Arrow Left/Right reorder
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (!editMode) return;
        if (selectedNodeIds.size === 0) return;
        const firstId = Array.from(selectedNodeIds)[0];
        const targetSeat = findSeatById(ac.root, firstId);
        if (!targetSeat) return;

        // Prevent interfering with inputs
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          // add sibling after
          const parentInfo = findParentInfo(ac.root, firstId);
          if (parentInfo?.parent) {
            const { parent, index } = parentInfo;
            const { root: pruned, seat: extracted } = extractSeat(
              ac.root,
              firstId,
            );
            const newSeat: SeatNode = {
              id: generateId(),
              name: 'New Seat',
              holder: '',
              roles: [],
              accent: '#3b82f6',
              children: [],
            };
            const updatedRoot = insertSeatAtIndex(
              pruned,
              parent.id,
              newSeat,
              index + 1,
            );
            setAC({ ...ac, root: updatedRoot });
            setSelectedNodeIds(new Set([newSeat.id]));
          }
        } else if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          // add child
          const updatedRoot = addChild(ac.root, firstId, { name: 'New Seat' });
          // pick the last child id as selected
          const parent = findSeatById(updatedRoot, firstId);
          const newChild = parent?.children[parent?.children.length - 1];
          setAC({ ...ac, root: updatedRoot });
          if (newChild) setSelectedNodeIds(new Set([newChild.id]));
        } else if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          // demote: become child of previous sibling if exists
          const info = findParentInfo(ac.root, firstId);
          if (!info?.parent) return;
          const { parent, index } = info;
          if (index <= 0) return;
          const prevSibling = parent.children[index - 1];
          const { root: pruned, seat: extracted } = extractSeat(
            ac.root,
            firstId,
          );
          if (extracted) {
            const updatedRoot = addChild(pruned, prevSibling.id, extracted);
            setAC({ ...ac, root: updatedRoot });
          }
        } else if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          // promote: move before parent at grandparent level
          const info = findParentInfo(ac.root, firstId);
          if (!info?.parent) return;
          const gpInfo = findParentInfo(ac.root, info.parent.id);
          const { root: pruned, seat: extracted } = extractSeat(
            ac.root,
            firstId,
          );
          if (!extracted) return;
          if (!gpInfo?.parent) return;
          const { parent: grand, index: parentIndex } = gpInfo;
          if (!grand) return;
          const updatedRoot = insertSeatAtIndex(
            pruned,
            grand.id,
            extracted,
            parentIndex,
          );
          setAC({ ...ac, root: updatedRoot });
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const seat = findSeatById(ac.root, firstId);
          if (seat) handleMoveLeft(seat);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const seat = findSeatById(ac.root, firstId);
          if (seat) handleMoveRight(seat);
        } else if (e.key === 'Escape') {
          setSelectedNodeIds(new Set());
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [
      editMode,
      selectedNodeIds,
      ac,
      setAC,
      extractSeat,
      findParentInfo,
      handleMoveLeft,
      handleMoveRight,
    ]);

    const onNodeDragStop = useCallback(
      (_: any, node?: Node) => {
        if (!node) return;
        if (ignoreNextDragStopRef.current) {
          ignoreNextDragStopRef.current = false;
          return;
        }
        // Clear highlight on drag stop
        setHighlightMap({});
        // Re-enable auto-fit for the next non-drag graph change only if needed
        setTimeout(() => {
          suppressAutoFitRef.current = false;
        }, 50);
        // Persist position (schedule outside of render)
        setTimeout(() => {
          setNodes((nds: Node[]) =>
            nds.map((n: Node) =>
              n && n.id === node.id ? { ...n, position: node.position } : n,
            ),
          );
          setPositionsById((prev) => {
            const next = { ...prev, [node.id]: node.position };
            setMetadata((m: Metadata) => ({
              ...(m as Metadata),
              acLayout: next,
            }));
            return next;
          });
        }, 0);

        // In edit mode, attempt structure reparenting by drop proximity
        if (editMode && rf) {
          try {
            const target = rf?.getNodes?.().find((n: any) => {
              if (!n || n.id === node.id) return false;
              const width = 300;
              const height = 160;
              const nx = n.position.x;
              const ny = n.position.y;
              const withinX = Math.abs(node.position.x - nx) < width / 2 + 60;
              const isBelow = node.position.y > ny + height * 0.2;
              const nearBottom =
                Math.abs(node.position.y - (ny + height / 2)) < 120;
              return withinX && isBelow && nearBottom;
            });
            if (target?.id && node?.id) {
              // Prevent cycles: disallow moving under own descendant
              if (
                !isDescendant(ac.root, node.id as string, target.id as string)
              ) {
                const { root: pruned, seat: extracted } = extractSeat(
                  ac.root,
                  node.id as string,
                );
                if (extracted) {
                  const updatedRoot = addChild(
                    pruned,
                    target.id as string,
                    extracted,
                  );
                  // schedule structural update to avoid setState during render of other components
                  setTimeout(() => setAC({ ...ac, root: updatedRoot }), 0);
                  setDropFlashById((m) => ({
                    ...m,
                    [target.id as string]: Date.now(),
                  }));
                  toast.success('Seat moved');
                }
              }
            }
          } catch {}

          // Top-edge drop: promote to parent/root if dropped above a node
          try {
            // Find the closest node above current position
            const above = rf
              ?.getNodes?.()
              .filter((n: any) => n && n.id !== node.id)
              .find((n: any) => {
                const width = 300;
                const height = 160;
                const nx = n.position.x;
                const ny = n.position.y;
                const withinX = Math.abs(node.position.x - nx) < width / 2 + 60;
                const isAbove = node.position.y < ny - height * 0.2;
                const nearTop =
                  Math.abs(node.position.y - (ny - height / 2)) < 120;
                return withinX && isAbove && nearTop;
              });

            if (above?.id && node?.id) {
              // If above is the current root, promote dragged node to root
              if (above.id === ac.root.id && node.id !== ac.root.id) {
                const { root: pruned, seat: extracted } = extractSeat(
                  ac.root,
                  node.id as string,
                );
                if (extracted) {
                  const newRoot: SeatNode = {
                    ...extracted,
                    children: [...(extracted.children || []), pruned],
                  };
                  setTimeout(() => setAC({ ...ac, root: newRoot }), 0);
                  setDropFlashById((m) => ({ ...m, [ac.root.id]: Date.now() }));
                  toast.success('Seat promoted to root');
                }
              } else if (
                !isDescendant(ac.root, node.id as string, above?.id as string)
              ) {
                // Otherwise, promote dragged node to become sibling above's parent level
                const parentInfo = findParentInfo(ac.root, above?.id as string);
                const { root: pruned, seat: extracted } = extractSeat(
                  ac.root,
                  node.id as string,
                );
                if (parentInfo?.parent && extracted) {
                  const { parent, index } = parentInfo;
                  const updatedRoot = insertSeatAtIndex(
                    pruned,
                    parent.id,
                    extracted,
                    index,
                  );
                  setTimeout(() => setAC({ ...ac, root: updatedRoot }), 0);
                  setDropFlashById((m) => ({ ...m, [parent.id]: Date.now() }));
                  toast.success('Seat repositioned above');
                }
              }
            }
          } catch {}

          // Left/right-edge drop: insert as sibling before/after a node
          try {
            const sideTarget = rf
              ?.getNodes?.()
              .filter((n: any) => n && n.id !== node.id)
              .find((n: any) => {
                const width = 300;
                const height = 160;
                const nx = n.position.x;
                const ny = n.position.y;
                const sameRow = Math.abs(node.position.y - ny) < height * 0.4;
                const leftSide = node.position.x < nx - width * 0.35;
                const rightSide = node.position.x > nx + width * 0.35;
                return sameRow && (leftSide || rightSide);
              });

            if (sideTarget?.id && node?.id) {
              if (
                !isDescendant(
                  ac.root,
                  node.id as string,
                  sideTarget.id as string,
                )
              ) {
                const parentInfo = findParentInfo(ac.root, sideTarget.id);
                const { root: pruned, seat: extracted } = extractSeat(
                  ac.root,
                  node.id as string,
                );
                if (parentInfo?.parent && extracted) {
                  const { parent, index } = parentInfo;
                  const insertAfter =
                    node.position.x > (sideTarget.position?.x || 0);
                  const updatedRoot = insertSeatAtIndex(
                    pruned,
                    parent.id,
                    extracted,
                    insertAfter ? index + 1 : index,
                  );
                  setTimeout(() => setAC({ ...ac, root: updatedRoot }), 0);
                  setDropFlashById((m) => ({ ...m, [parent.id]: Date.now() }));
                  toast.success(
                    insertAfter ? 'Seat moved after' : 'Seat moved before',
                  );
                }
              }
            }
          } catch {}
        }
      },
      [setNodes, setMetadata, editMode, rf, ac, setAC, extractSeat],
    );

    // Wait for container to be ready before rendering React Flow
    useEffect(() => {
      if (previewRef.current) {
        const rect = previewRef.current.getBoundingClientRect();
        console.log('[AC Debug] Container dimensions:', {
          width: rect.width,
          height: rect.height,
        });
        if (rect.width > 0 && rect.height > 0) {
          setContainerReady(true);
        } else {
          // Try again after a short delay
          const timer = setTimeout(() => {
            const newRect = previewRef.current?.getBoundingClientRect();
            if (newRect && newRect.width > 0 && newRect.height > 0) {
              setContainerReady(true);
            }
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    }, []);

    // Do not auto-fit on every graphVersion; only when explicitly requested via autoFitNextRef

    // Global composer switcher for cross-linking to VTO and Sheet
    const { setComposer } = useGlobalComposer();

    return (
      <div className="relative flex flex-col gap-4 p-6">
        <ComposerEditingOverlay isVisible={status === 'streaming'} chatStatus={chatStatus} />
        <div className="flex items-center justify-between rounded-lg border bg-white/70 dark:bg-zinc-900/70 backdrop-blur px-3 py-2">
          <div className="text-sm text-muted-foreground">
            {ac.title || 'Accountability Chart'}
          </div>
          <div className="flex items-center gap-2">
            {/* Quarter selector */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Quarter:</span>
              <select
                className="text-xs px-2 py-1 border rounded"
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
              >
                {getQuarterList(selectedQuarter, 2).map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            {/* L10 Meeting Management */}
            <div className="flex items-center gap-2">
              {!l10Enabled ? (
                <button
                  type="button"
                  onClick={startNewL10Meeting}
                  className="px-3 py-1 text-xs bg-eos-orange text-white rounded hover:bg-eos-orange/90 font-medium"
                >
                  Start Level 10
                </button>
              ) : (
                <>
                  <select
                    value={activeMeetingId || ''}
                    onChange={(e) => setActiveMeeting(e.target.value || null)}
                    className="text-xs px-2 py-1 border rounded"
                  >
                    <option value="">No Active L10</option>
                    {l10Meetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        L10 - {new Date(meeting.date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={startNewL10Meeting}
                    className="p-1 text-xs bg-eos-orange text-white rounded hover:bg-eos-orange/90"
                    title="Start New Level 10"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {l10Meetings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm('Remove all L10 meetings from this chart?')
                        ) {
                          setMetadata((m: Metadata) => ({
                            ...(m as Metadata),
                            l10Enabled: false,
                            l10Meetings: [],
                            activeMeetingId: undefined,
                          }));
                        }
                      }}
                      className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                    >
                      Remove L10
                    </button>
                  )}
                </>
              )}
            </div>
            {/* Edit mode toggle */}
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
              />
              Edit mode
            </label>
            {/* People Analyzer */}
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => openPeopleAnalyzer(ac.root)}
            >
              People Analyzer
            </button>
            {/* Removed Scorecard button to reduce UI bloat */}
            {/* Export PNG */}
            <button
              type="button"
              onClick={exportPng}
              className="text-xs px-3 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Export PNG
            </button>
            {/* Export CSV */}
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                try {
                  const rows: string[] = [];
                  rows.push(
                    [
                      'Seat',
                      'Holder',
                      'G',
                      'W',
                      'C',
                      'Rocks',
                      'Measurables',
                      'Issues',
                      'Processes',
                    ].join(','),
                  );
                  const seats = flattenSeats(ac.root);
                  for (const s of seats) {
                    const gwc = s.eos?.gwc || {};
                    const rocks = (s.eos?.rocks || []).filter(
                      (r) => r.quarter === selectedQuarter,
                    ).length;
                    const meas = (s.eos?.measurables || []).length;
                    const issues = Array.isArray(s.eos?.issues)
                      ? s.eos?.issues.filter((i) => i.status === 'open').length
                      : s.eos?.issuesCount || 0;
                    const procs = (s.eos?.processes || []).length;
                    rows.push(
                      [
                        JSON.stringify(s.name),
                        JSON.stringify(s.holder || ''),
                        gwc.getsIt ? '1' : '0',
                        gwc.wantsIt ? '1' : '0',
                        gwc.capacity ? '1' : '0',
                        String(rocks),
                        String(meas),
                        String(issues),
                        String(procs),
                      ].join(','),
                    );
                  }
                  const csv = rows.join('\n');
                  const blob = new Blob([csv], {
                    type: 'text/csv;charset=utf-8;',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `AC_${selectedQuarter}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success('Exported CSV');
                } catch (e) {
                  console.error(e);
                  toast.error('Failed to export CSV');
                }
              }}
            >
              Export CSV
            </button>
            {/* Make Primary */}
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={async () => {
                try {
                  const res = await fetch('/api/user-settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      primaryAccountabilityId:
                        (window as any)?.composer?.documentId || undefined,
                    }),
                  });
                  if (!res.ok) throw new Error('Failed to set primary');
                  toast.success('Set as primary Accountability Chart');
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
        <div
          className="relative w-full rounded-lg border bg-gray-50 dark:bg-zinc-900 overflow-hidden shadow-inner"
          ref={previewRef}
          style={{ width: '100%', height: '600px', minHeight: '520px' }}
        >
          {status === 'streaming' && !hasParsedContent && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 rounded-lg border">
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-5 w-5 rounded-full border-2 border-zinc-300 border-t-transparent" />
                <div>Generating your Accountability Chart…</div>
              </div>
            </div>
          )}
          {containerReady && (
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                inset: 0,
              }}
            >
              {/* EOS gradient background behind React Flow */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  zIndex: 0,
                  background:
                    'radial-gradient(60% 60% at 20% 10%, rgba(255,118,0,0.08), transparent), radial-gradient(60% 60% at 80% 90%, rgba(0,46,93,0.08), transparent)',
                }}
              />
              {hasParsedContent ? (
                <>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeDragStop={onNodeDragStop}
                    onNodeDragStart={() => {
                      suppressAutoFitRef.current = true;
                      requestAnimationFrame(updateOverlayRectsFromDOM);
                    }}
                    onNodeDrag={(_event: unknown, node: Node) => {
                      if (!rf) return;
                      // Use rAF to avoid synchronous setState during render
                      requestAnimationFrame(() => {
                        try {
                          const rfNodes = rf
                            .getNodes()
                            .filter((n: any) => n && n.id !== node?.id);
                          const updated: Record<
                            string,
                            'top' | 'bottom' | 'left' | 'right' | null
                          > = {};
                          const rects: Record<
                            string,
                            {
                              top: number;
                              left: number;
                              width: number;
                              height: number;
                            }
                          > = {};
                          for (const n of rfNodes) {
                            const width = 300;
                            const height = 160;
                            const nx = n.position.x;
                            const ny = n.position.y;
                            const withinX =
                              Math.abs((node?.position?.x || 0) - nx) <
                              width / 2 + 60;
                            const below =
                              (node?.position?.y || 0) > ny + height * 0.2;
                            const above =
                              (node?.position?.y || 0) < ny - height * 0.2;
                            const nearBottom =
                              Math.abs(
                                (node?.position?.y || 0) - (ny + height / 2),
                              ) < 120;
                            const nearTop =
                              Math.abs(
                                (node?.position?.y || 0) - (ny - height / 2),
                              ) < 120;
                            const sameRow =
                              Math.abs((node?.position?.y || 0) - ny) <
                              height * 0.4;
                            const leftSide =
                              (node?.position?.x || 0) < nx - width * 0.35;
                            const rightSide =
                              (node?.position?.x || 0) > nx + width * 0.35;
                            let edge:
                              | 'top'
                              | 'bottom'
                              | 'left'
                              | 'right'
                              | null = null;
                            if (withinX && below && nearBottom) edge = 'bottom';
                            else if (withinX && above && nearTop) edge = 'top';
                            else if (sameRow && (leftSide || rightSide))
                              edge = leftSide ? 'left' : 'right';
                            updated[n.id] = edge;

                            // Compute absolute rect relative to preview container
                            const container = previewRef.current;
                            if (container) {
                              const cRect = container.getBoundingClientRect();
                              // ReactFlow node position is in the pane's coordinate system; we approximate absolute mapping via stored position
                              rects[n.id] = {
                                top: ny + 100 - cRect.top,
                                left: nx - cRect.left,
                                width: width,
                                height: height,
                              };
                            }
                          }
                          setHighlightMap(updated);
                          setOverlayRects(rects);
                        } catch {}
                      });
                    }}
                    onInit={(instance: any) => {
                      setRf(instance);
                      setReactFlowInstance(instance);
                      setFlowInitialized(true);
                      console.log('[AC Debug] React Flow initialized', {
                        nodes: instance.getNodes(),
                        edges: instance.getEdges(),
                      });

                      // Trigger initial render after initialization
                      setTimeout(() => {
                        setGraphVersion((v) => v + 1);
                        autoFitNextRef.current = true;
                        updateOverlayRectsFromDOM();
                      }, 100);
                    }}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    minZoom={0.5}
                    maxZoom={1.5}
                    defaultEdgeOptions={{
                      type: 'smoothstep',
                      animated: false,
                      style: { stroke: '#94a3b8', strokeWidth: 2 },
                      markerEnd: {
                        type: 'arrowclosed' as const,
                        color: '#94a3b8',
                      },
                    }}
                    snapToGrid
                    snapGrid={[20, 20]}
                    nodesDraggable={editMode}
                    nodesConnectable={false}
                    elementsSelectable
                    panOnDrag
                    panActivationKeyCode="Space"
                    panOnScroll={false}
                    zoomOnScroll={false}
                    zoomOnPinch={true}
                    zoomOnDoubleClick={false}
                    selectionOnDrag
                    multiSelectionKeyCode="Shift"
                    preventScrolling={false}
                    defaultMarkerColor="#94a3b8"
                  >
                    <MiniMap pannable zoomable />
                    <Controls showInteractive={false} />
                    <Background color="#e5e7eb" gap={20} size={1} />
                  </ReactFlow>
                  {/* Fixed overlay layer for highlights and drop flashes */}
                  <div
                    className="pointer-events-none absolute inset-0 z-[60]"
                    aria-hidden
                  >
                    {nodes.map((n) => {
                      const rect = overlayRects[n.id];
                      if (!rect) return null;
                      const edge = highlightMap[n.id];
                      const flash = dropFlashById[n.id];
                      return (
                        <div
                          key={`ov-${n.id}-${flash || 0}`}
                          style={{
                            position: 'absolute',
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                          }}
                        >
                          {edge === 'top' && (
                            <div className="absolute top-0 left-0 right-0 h-3 bg-blue-500/90 shadow-[0_0_12px_rgba(59,130,246,0.9)] animate-pulse" />
                          )}
                          {edge === 'bottom' && (
                            <div className="absolute bottom-0 left-0 right-0 h-3 bg-blue-500/90 shadow-[0_0_12px_rgba(59,130,246,0.9)] animate-pulse" />
                          )}
                          {edge === 'left' && (
                            <div className="absolute top-0 bottom-0 left-0 w-3 bg-blue-500/90 shadow-[0_0_12px_rgba(59,130,246,0.9)] animate-pulse" />
                          )}
                          {edge === 'right' && (
                            <div className="absolute top-0 bottom-0 right-0 w-3 bg-blue-500/90 shadow-[0_0_12px_rgba(59,130,246,0.9)] animate-pulse" />
                          )}
                          {!!flash && (
                            <div className="absolute inset-0 rounded-lg ac-drop-flash" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                  Waiting for AI to generate your Accountability Chart...
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowAddSeatModal(true);
              setParentSeatId(ac.root.id);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Add Root Seat
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                try {
                  rf?.fitView?.({ padding: 0.2, duration: 200 });
                } catch {}
              }}
            >
              Fit View
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  (((metadata as any)?.layoutMode as any) || 'balanced') ===
                  'manual'
                }
                onChange={(e) => {
                  const nextMode = e.target.checked ? 'manual' : 'balanced';
                  if (nextMode === 'manual') {
                    seedManualPositionsFromRF();
                  }
                  setMetadata((m: Metadata) => ({
                    ...(m as Metadata),
                    layoutMode: nextMode,
                  }));
                  try {
                    rf?.fitView?.({ padding: 0.2, duration: 200 });
                  } catch {}
                  setGraphVersion((v) => v + 1);
                }}
              />
              Manual layout
            </label>
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                // Clear saved positions and switch to balanced layout
                setPositionsById({});
                setMetadata((m: Metadata) => ({
                  ...(m as Metadata),
                  acLayout: {},
                  layoutMode: 'balanced',
                }));
                setGraphVersion((v) => v + 1);
                try {
                  rf?.fitView?.({ padding: 0.2, duration: 200 });
                } catch {}
              }}
            >
              Reset positions
            </button>
          </div>
        </div>

        {/* L10 Meeting Panel - Shows when there's an active meeting */}
        {activeMeeting && (
          <div className="mt-6">
            <L10MeetingPanel
              meeting={activeMeeting}
              seats={ac ? [ac.root] : []}
              onUpdateMeeting={(meeting) => {
                setMetadata((m: Metadata) => ({
                  ...(m as Metadata),
                  l10Meetings: (m?.l10Meetings || []).map((mtg) =>
                    mtg.id === meeting.id ? meeting : mtg,
                  ),
                }));
              }}
              onStartRecording={(itemId) => {
                // Mark session recording active and track current agenda item. Do not auto-open modal.
                setMetadata((m: Metadata) => ({
                  ...(m as Metadata),
                  l10Recording: {
                    active: true,
                    startedAt:
                      (m as Metadata)?.l10Recording?.startedAt || Date.now(),
                    currentItemId: itemId,
                  },
                }));
              }}
              onStopRecording={() => {
                // End session recording. Do not force modal closure here.
                setMetadata((m: Metadata) => ({
                  ...(m as Metadata),
                  l10Recording: {
                    active: false,
                    startedAt: 0,
                    currentItemId: undefined,
                  },
                }));
              }}
              onOpenRecordingSuite={() => setShowRecordingModal(true)}
            />
          </div>
        )}

        {showAddSeatModal && (
          <SeatModal
            mode="add"
            initial={{}}
            onClose={() => {
              setShowAddSeatModal(false);
              setParentSeatId(null);
            }}
            onSubmit={(data) => {
              console.log('[AC Debug] Add Seat submit', { parentSeatId, data });
              if (parentSeatId) {
                const updatedRoot = addChild(ac.root, parentSeatId, data);
                const next = { ...ac, root: updatedRoot };
                setLocalAc(next);
                setAC(next);
                toast.success('Seat added');
              }
              setShowAddSeatModal(false);
              setParentSeatId(null);
            }}
          />
        )}

        {showEditModal && editingSeat && (
          <SeatModal
            mode="edit"
            initial={editingSeat}
            onClose={() => {
              setShowEditModal(false);
              setEditingSeat(null);
            }}
            onSubmit={(data) => {
              if (editingSeat) {
                const updatedRoot = updateSeat(ac.root, editingSeat.id, data);
                setAC({ ...ac, root: updatedRoot });
                toast.success('Seat updated');
              }
              setShowEditModal(false);
              setEditingSeat(null);
            }}
          />
        )}

        {peopleAnalyzerSeat && (
          <PeopleAnalyzerModal
            seat={peopleAnalyzerSeat}
            parent={null}
            onClose={() => setPeopleAnalyzerSeat(null)}
            onSave={(updates) => {
              // Apply updates to each seat
              let next = ac;
              for (const [seatId, eos] of Object.entries(updates)) {
                next = updateSeatEos(next, seatId, () => eos);
              }
              setAC(next);
              toast.success('People Analyzer saved');
              setPeopleAnalyzerSeat(null);
            }}
          />
        )}

        {rocksSeat && (
          <RocksModal
            seat={rocksSeat}
            quarter={selectedQuarter}
            onClose={() => setRocksSeat(null)}
            onSave={(rocks) => {
              const next = updateSeatEos(ac, rocksSeat.id, (prev) => ({
                ...(prev || {}),
                rocks,
              }));
              setAC(next);
              toast.success('Rocks saved');
              setRocksSeat(null);
            }}
          />
        )}

        {measurablesSeat && (
          <MeasurablesModal
            seat={measurablesSeat}
            onClose={() => setMeasurablesSeat(null)}
            onSave={(measurables) => {
              const next = updateSeatEos(ac, measurablesSeat.id, (prev) => ({
                ...(prev || {}),
                measurables,
              }));
              setAC(next);
              toast.success('Measurables saved');
              setMeasurablesSeat(null);
            }}
          />
        )}

        {processesSeat && (
          <ProcessesModal
            seat={processesSeat}
            onClose={() => setProcessesSeat(null)}
            onSave={(processes) => {
              const next = updateSeatEos(ac, processesSeat.id, (prev) => ({
                ...(prev || {}),
                processes,
              }));
              setAC(next);
              toast.success('Processes saved');
              setProcessesSeat(null);
            }}
          />
        )}

        {issuesSeat && (
          <IssuesModal
            seat={issuesSeat}
            onClose={() => setIssuesSeat(null)}
            onSave={(issues) => {
              const next = updateSeatEos(ac, issuesSeat.id, (prev) => ({
                ...(prev || {}),
                issues,
              }));
              setAC(next);
              toast.success('Issues saved');
              setIssuesSeat(null);
            }}
          />
        )}

        {showScorecardModal && (
          <ScorecardModal
            seat={ac.root}
            onClose={() => setShowScorecardModal(false)}
          />
        )}

        {/* Recording Modal for L10 Integration */}
        {showRecordingModal && (
          <RecordingModal
            isOpen={showRecordingModal}
            onClose={() => {
              setShowRecordingModal(false);
              setCurrentRecordingContext(null);
            }}
            chatId={undefined}
            selectedRecordingId={undefined}
          />
        )}
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
        toast.success('Accountability Chart JSON copied to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download PNG',
      onClick: async () => {
        toast.success('Use the Export PNG button in the header to download.');
      },
    },
  ],
  toolbar: [],
});
