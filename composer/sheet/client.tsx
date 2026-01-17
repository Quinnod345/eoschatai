import { Composer } from '@/components/create-composer';
import { ComposerEditingOverlay } from '@/components/composer-editing-overlay';
import {
  CopyIcon,
  DownloadIcon,
  LineChartIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
} from '@/components/icons';
import { SpreadsheetEditor } from '@/components/sheet-editor';
import { parse, unparse } from 'papaparse';
import { toast } from '@/lib/toast-system';
// Import will be done dynamically to avoid SSR issues

type Metadata = any;

export const sheetComposer = new Composer<'sheet', Metadata>({
  kind: 'sheet',
  description: 'Useful for working with spreadsheets',
  initialize: async () => {},
  onStreamPart: ({ setComposer, streamPart }) => {
    if (streamPart.type === 'sheet-delta') {
      setComposer((draftComposer) => ({
        ...draftComposer,
        content: streamPart.content as string,
        isVisible: true,
        status: 'streaming',
      }));
    }
  },
  content: ({
    content,
    currentVersionIndex,
    isCurrentVersion,
    onSaveContent,
    status,
    chatStatus,
  }) => {
    return (
      <div className="relative">
        <ComposerEditingOverlay isVisible={status === 'streaming'} chatStatus={chatStatus} />
        <SpreadsheetEditor
          content={content}
          currentVersionIndex={currentVersionIndex}
          isCurrentVersion={isCurrentVersion}
          saveContent={onSaveContent}
          status={status}
        />
      </div>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon />,
      description: 'Copy as .csv',
      onClick: ({ content }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });

        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== ''),
        );

        const cleanedCsv = unparse(nonEmptyRows);

        navigator.clipboard.writeText(cleanedCsv);
        toast.success('Copied csv to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download as .xlsx',
      onClick: async ({ content, title }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });

        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== ''),
        );

        try {
          // Dynamically import xlsx to avoid SSR issues
          const XLSX = await import('xlsx');

          // Create a new workbook and add the data
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.aoa_to_sheet(nonEmptyRows);

          // Use the composer title for the sheet name (with character limit)
          const sheetName = title
            ? title.substring(0, 30).replace(/[*?:/\\[\]]/g, '_')
            : 'Sheet1';

          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

          // Generate XLSX file data
          const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array',
          });

          // Create Blob and download
          const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;

          // Use the composer title for the filename, with fallback
          const safeTitle =
            title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'spreadsheet';
          a.download = `${safeTitle}.xlsx`;

          document.body.appendChild(a);
          a.click();

          // Clean up
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success(`Downloaded "${title}" as Excel spreadsheet`);
        } catch (error) {
          console.error('Error creating Excel file:', error);
          toast.error('Failed to create Excel file');
        }
      },
    },
    {
      icon: <SparklesIcon />,
      description: 'Make Primary',
      onClick: async () => {
        try {
          const res = await fetch('/api/user-settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              primaryScorecardId:
                (window as any)?.composer?.documentId || undefined,
            }),
          });
          if (!res.ok) throw new Error('Failed');
          toast.success('Set as primary Scorecard');
        } catch (e) {
          console.error(e);
          toast.error('Failed to set as primary');
        }
      },
    },
  ],
  toolbar: [
    {
      description: 'Format and clean data',
      icon: <SparklesIcon />,
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Can you please format and clean the data?',
        });
      },
    },
    {
      description: 'Analyze and visualize data',
      icon: <LineChartIcon />,
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Can you please analyze and visualize the data by creating a new code composer in python?',
        });
      },
    },
  ],
});
