import { memo } from 'react';

import type { ComposerKind } from './composer';
import {
  FileIcon,
  LoaderIcon,
  MessageIcon,
  PencilEditIcon,
  ChartIcon,
} from './icons';
import { toast } from 'sonner';
import { useComposer } from '@/hooks/use-composer';

const getActionText = (
  type: 'create' | 'update' | 'request-suggestions',
  tense: 'present' | 'past',
) => {
  switch (type) {
    case 'create':
      return tense === 'present' ? 'Creating' : 'Created';
    case 'update':
      return tense === 'present' ? 'Updating' : 'Updated';
    case 'request-suggestions':
      return tense === 'present'
        ? 'Adding suggestions'
        : 'Added suggestions to';
    default:
      return null;
  }
};

interface DocumentToolResultProps {
  type?: 'create' | 'update' | 'request-suggestions';
  result: { id?: string; title?: string; kind?: ComposerKind };
  isReadonly?: boolean;
}

export function DocumentToolResult({
  type,
  result,
  isReadonly,
}: DocumentToolResultProps) {
  const { setComposer } = useComposer();

  let parsedResult: any = result;
  if (typeof result === 'string') {
    try {
      parsedResult = JSON.parse(result);
    } catch (e) {
      // Not JSON, keep as string for default rendering if it doesn't fit other structures
    }
  }

  // AGGRESSIVE OVERRIDE for raw calendar JSON based on content signature
  if (
    typeof parsedResult === 'object' &&
    parsedResult !== null &&
    typeof parsedResult._formatInstructions === 'string' && // Key field from your JSON
    Array.isArray(parsedResult.formattedEvents) && // Another key field
    parsedResult.isCalendarEvents === true // Existing flag for good measure
  ) {
    // If it matches our calendar tool's raw output structure, ONLY show the message.
    // This takes precedence over hideJSON if the structure is a clear match.
    return parsedResult.message ? (
      <div
        className="text-sm text-zinc-700 dark:text-zinc-300"
        data-testid="calendar-tool-result-aggressive-hide"
      >
        {/* Intentionally only rendering the user-facing message part of the tool result */}
        {parsedResult.message}
      </div>
    ) : null; // Or render nothing if no message field
  }

  // Original Priority handling for calendar events with hideJSON flag (retained as fallback)
  if (
    typeof parsedResult === 'object' &&
    parsedResult !== null &&
    parsedResult.isCalendarEvents === true &&
    parsedResult.hideJSON === true
  ) {
    return parsedResult.message ? (
      <div
        className="text-sm text-zinc-700 dark:text-zinc-300"
        data-testid="calendar-tool-result-message-only"
      >
        {parsedResult.message}
      </div>
    ) : null;
  }

  // Handle document results (composer results)
  if (
    typeof parsedResult === 'object' &&
    parsedResult !== null &&
    (parsedResult.id || parsedResult.documentId) &&
    parsedResult.title
  ) {
    const docId = parsedResult.id || parsedResult.documentId;
    const docKind = parsedResult.kind || 'text';

    // Get the appropriate icon based on document kind
    const getDocIcon = (kind: string) => {
      switch (kind) {
        case 'chart':
          return <ChartIcon size={16} />;
        case 'code':
          return <FileIcon size={16} />;
        case 'image':
          return (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m21 15-5-5-9 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          );
        default:
          return <FileIcon size={16} />;
      }
    };

    return (
      <button
        type="button"
        onClick={(event) => {
          if (isReadonly) {
            toast.error(
              'Viewing files in shared chats is currently not supported.',
            );
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const boundingBox = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };

          setComposer((currentComposer) => ({
            ...currentComposer,
            isVisible: true,
            documentId: docId,
            kind: docKind as ComposerKind,
            title: parsedResult.title,
            boundingBox,
          }));
        }}
        className="flex items-center px-3 py-2 text-sm rounded-md bg-muted hover:bg-muted/80 transition-colors gap-2 w-fit"
      >
        {getDocIcon(docKind)}
        <span className="font-medium">{parsedResult.title}</span>
        <span className="text-xs text-muted-foreground">
          {parsedResult.content ===
          'The document has been updated successfully.'
            ? 'Updated'
            : 'Click to view'}
        </span>
      </button>
    );
  }

  // Generic tool result handling for objects with status and message
  if (
    typeof parsedResult === 'object' &&
    parsedResult !== null &&
    Object.prototype.hasOwnProperty.call(parsedResult, 'status') &&
    Object.prototype.hasOwnProperty.call(parsedResult, 'message')
  ) {
    const showPreBlock = !(parsedResult.hideJSON === true);

    if (parsedResult.status === 'success') {
      return (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          {parsedResult.message}
          {showPreBlock && (
            <pre className="mt-2 whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs">
              {JSON.stringify(parsedResult, null, 2)}
            </pre>
          )}
        </div>
      );
    } else if (parsedResult.status === 'error') {
      return (
        <div className="text-sm text-red-500">
          Tool Error: {parsedResult.message}
          {showPreBlock && parsedResult.error && (
            <pre className="mt-2 whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs">
              {JSON.stringify({ errorDetails: parsedResult.error }, null, 2)}
            </pre>
          )}
        </div>
      );
    } else {
      // Fallback for other status types, respecting hideJSON
      return (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          Tool status: {parsedResult.status} - {parsedResult.message}
          {showPreBlock && (
            <pre className="mt-2 whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs">
              {JSON.stringify(parsedResult, null, 2)}
            </pre>
          )}
        </div>
      );
    }
  }

  // Default rendering for any other unhandled tool results or simple strings
  // If 'result' itself was an object with hideJSON, respect it.
  const finalHidePre =
    typeof parsedResult === 'object' &&
    parsedResult !== null &&
    parsedResult.hideJSON === true;

  return (
    <div
      data-testid="document-tool-result-default"
      className="text-sm text-zinc-700 dark:text-zinc-300"
    >
      {/* Only show prefix if not a hidden message with content already displayed */}
      {!(finalHidePre && typeof parsedResult?.message === 'string') &&
        'Tool execution result:'}

      {finalHidePre && typeof parsedResult?.message === 'string' ? (
        <div>{parsedResult.message}</div>
      ) : !finalHidePre ? (
        <pre className="mt-2 whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs">
          {typeof result === 'string'
            ? result
            : JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

interface DocumentToolCallProps {
  type: 'create' | 'update' | 'request-suggestions';
  args: { title: string };
  isReadonly: boolean;
}

function PureDocumentToolCall({
  type,
  args,
  isReadonly,
}: DocumentToolCallProps) {
  const { setComposer } = useComposer();

  return (
    <button
      type="button"
      className="cursor pointer w-fit border py-2 px-3 rounded-xl flex flex-row items-start justify-between gap-3"
      onClick={(event) => {
        if (isReadonly) {
          toast.error(
            'Viewing files in shared chats is currently not supported.',
          );
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setComposer((currentComposer) => ({
          ...currentComposer,
          isVisible: true,
          boundingBox,
        }));
      }}
    >
      <div className="flex flex-row gap-3 items-start">
        <div className="text-zinc-500 mt-1">
          {type === 'create' ? (
            <FileIcon />
          ) : type === 'update' ? (
            <PencilEditIcon />
          ) : type === 'request-suggestions' ? (
            <MessageIcon />
          ) : null}
        </div>

        <div className="text-left">
          {`${getActionText(type, 'present')} ${args.title ? `"${args.title}"` : ''}`}
        </div>
      </div>

      <div className="animate-spin mt-1">{<LoaderIcon />}</div>
    </button>
  );
}

export const DocumentToolCall = memo(PureDocumentToolCall, () => true);
