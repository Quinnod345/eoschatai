'use client';

import { memo } from 'react';
import {
  X,
  FileText,
  Code,
  Image,
  Table,
  BarChart2,
  Target,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComposerKind } from './composer';

interface ComposerContextIndicatorProps {
  documentId: string;
  title: string;
  kind: ComposerKind;
  onClose?: () => void;
  className?: string;
}

const composerIcons: Record<ComposerKind, React.ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  code: <Code className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  sheet: <Table className="w-4 h-4" />,
  chart: <BarChart2 className="w-4 h-4" />,
  vto: <Target className="w-4 h-4" />,
  accountability: <Users className="w-4 h-4" />,
};

export const ComposerContextIndicator = memo(function ComposerContextIndicator({
  documentId,
  title,
  kind,
  onClose,
  className,
}: ComposerContextIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
        {composerIcons[kind]}
        <span className="text-sm font-medium">Editing Composer:</span>
      </div>
      <div className="flex-1">
        <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {title || 'Untitled'}
        </span>
        <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
          ID: {documentId.substring(0, 8)}...
        </span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
          aria-label="Close composer context"
        >
          <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </button>
      )}
    </div>
  );
});
