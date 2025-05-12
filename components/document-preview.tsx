'use client';

import {
  memo,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ArtifactKind, UIArtifact } from './artifact';
import { FileIcon, FullscreenIcon, ImageIcon, LoaderIcon } from './icons';
import { cn, fetcher } from '@/lib/utils';
import type { Document } from '@/lib/db/schema';
import { InlineDocumentSkeleton } from './document-skeleton';
import useSWR from 'swr';
import { Editor } from './text-editor';
import { DocumentToolCall, DocumentToolResult } from './document';
import { CodeEditor } from './code-editor';
import { useArtifact } from '@/hooks/use-artifact';
import equal from 'fast-deep-equal';
import { SpreadsheetEditor } from './sheet-editor';
import { ImageEditor } from './image-editor';
import { ChartPreview } from './chart-preview';

interface DocumentPreviewProps {
  isReadonly: boolean;
  result?: any;
  args?: any;
}

export function DocumentPreview({
  isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();

  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Array<Document>
  >(result ? `/api/document?id=${result.id}` : null, fetcher);

  const previewDocument = useMemo(() => documents?.[0], [documents]);
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((artifact) => ({
        ...artifact,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  if (artifact.isVisible) {
    if (result) {
      return (
        <DocumentToolResult
          type="create"
          result={{ id: result.id, title: result.title, kind: result.kind }}
          isReadonly={isReadonly}
        />
      );
    }

    if (args) {
      return (
        <DocumentToolCall
          type="create"
          args={{ title: args.title }}
          isReadonly={isReadonly}
        />
      );
    }
  }

  if (isDocumentsFetching) {
    return <LoadingSkeleton artifactKind={result.kind ?? args.kind} />;
  }

  const document: Document | null = previewDocument
    ? previewDocument
    : artifact.status === 'streaming'
      ? {
          title: artifact.title,
          kind: artifact.kind,
          content: artifact.content,
          id: artifact.documentId,
          createdAt: new Date(),
          userId: 'noop',
        }
      : null;

  if (!document) return <LoadingSkeleton artifactKind={artifact.kind} />;

  return (
    <div className="relative w-full cursor-pointer">
      <HitboxLayer
        hitboxRef={hitboxRef}
        result={result}
        setArtifact={setArtifact}
      />
      <DocumentHeader
        title={document.title}
        kind={document.kind}
        isStreaming={artifact.status === 'streaming'}
      />
      <DocumentContent document={document} />
    </div>
  );
}

const LoadingSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => (
  <div className="w-full">
    <div className="p-4 border rounded-t-2xl flex flex-row gap-2 items-center justify-between dark:bg-muted h-[57px] dark:border-zinc-700 border-b-0">
      <div className="flex flex-row items-center gap-3">
        <div className="text-muted-foreground">
          <div className="animate-pulse rounded-md size-4 bg-muted-foreground/20" />
        </div>
        <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-24" />
      </div>
      <div>
        <FullscreenIcon />
      </div>
    </div>
    {artifactKind === 'image' ? (
      <div className="overflow-y-scroll border rounded-b-2xl bg-muted border-t-0 dark:border-zinc-700">
        <div className="animate-pulse h-[257px] bg-muted-foreground/20 w-full" />
      </div>
    ) : (
      <div className="overflow-y-scroll border rounded-b-2xl p-8 pt-4 bg-muted border-t-0 dark:border-zinc-700">
        <InlineDocumentSkeleton />
      </div>
    )}
  </div>
);

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setArtifact,
}: {
  hitboxRef: React.RefObject<HTMLDivElement>;
  result: any;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact),
  ) => void;
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setArtifact((artifact) =>
        artifact.status === 'streaming'
          ? { ...artifact, isVisible: true }
          : {
              ...artifact,
              title: result.title,
              documentId: result.id,
              kind: result.kind,
              isVisible: true,
              boundingBox: {
                left: boundingBox.x,
                top: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            },
      );
    },
    [setArtifact, result],
  );

  return (
    <div
      className="size-full absolute top-0 left-0 rounded-xl z-10"
      ref={hitboxRef}
      onClick={handleClick}
      role="presentation"
      aria-hidden="true"
    >
      <div className="w-full p-4 flex justify-end items-center">
        <div className="absolute right-[9px] top-[13px] p-2 hover:dark:bg-zinc-700 rounded-md hover:bg-zinc-100">
          <FullscreenIcon />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) return false;
  return true;
});

const PureDocumentHeader = ({
  title,
  kind,
  isStreaming,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
}) => (
  <div className="p-4 border rounded-t-2xl flex flex-row gap-2 items-start sm:items-center justify-between dark:bg-muted border-b-0 dark:border-zinc-700">
    <div className="flex flex-row items-start sm:items-center gap-3">
      <div className="text-muted-foreground">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        ) : kind === 'image' ? (
          <ImageIcon />
        ) : (
          <FileIcon />
        )}
      </div>
      <div className="-translate-y-1 sm:translate-y-0 font-medium">{title}</div>
    </div>
    <div className="w-8" />
  </div>
);

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact, metadata, setMetadata } = useArtifact();

  const containerClassName = cn(
    'h-[257px] overflow-y-scroll border rounded-b-2xl dark:bg-muted border-t-0 dark:border-zinc-700',
    {
      'p-4 sm:px-14 sm:py-16': document.kind === 'text',
      'p-0': document.kind === 'code',
      'p-4': document.kind === 'chart',
    },
  );

  const commonProps = {
    content: document.content ?? '',
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: artifact.status,
    saveContent: () => {},
    suggestions: [],
  };

  // For chart preview, parse JSON and render
  const renderChartPreview = () => {
    try {
      const content = document.content || '';
      console.log(
        'Attempting to render chart preview, content length:',
        content.length,
      );

      // First check for special markers
      const hasBeginMarker = content.includes('CHART_DATA_BEGIN');
      const hasEndMarker = content.includes('CHART_DATA_END');

      let chartData: any = null;

      if (hasBeginMarker && hasEndMarker) {
        // Extract JSON between markers
        const startIndex =
          content.indexOf('CHART_DATA_BEGIN') + 'CHART_DATA_BEGIN'.length;
        const endIndex = content.indexOf('CHART_DATA_END');

        if (startIndex >= 0 && endIndex > startIndex) {
          const jsonStr = content.substring(startIndex, endIndex).trim();
          console.log(
            'Found chart data between markers, length:',
            jsonStr.length,
          );
          chartData = JSON.parse(jsonStr);
          console.log('Successfully parsed chart data, type:', chartData.type);
        }
      } else {
        // Fallback to finding raw JSON
        const jsonStartIndex = content.indexOf('{') ?? -1;
        const jsonEndIndex = content.lastIndexOf('}') + 1;

        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          const jsonStr = content.substring(jsonStartIndex, jsonEndIndex);
          console.log('Found raw JSON in content, length:', jsonStr.length);
          chartData = JSON.parse(jsonStr || '{}');
          console.log('Successfully parsed raw JSON, type:', chartData?.type);
        }
      }

      if (chartData?.type && chartData?.data) {
        console.log('Rendering chart with type:', chartData.type);
        return (
          <div className="chart-preview-container w-full h-full flex items-center justify-center">
            <ChartPreview chartConfig={JSON.stringify(chartData)} />
          </div>
        );
      } else {
        console.log('Invalid chart data found, missing type or data fields');
      }
    } catch (error) {
      console.error('Failed to parse chart data for preview:', error);
    }

    return (
      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
        Chart preview loading...
      </div>
    );
  };

  return (
    <div className={containerClassName}>
      {document.kind === 'text' ? (
        <Editor {...commonProps} onSaveContent={() => {}} />
      ) : document.kind === 'code' ? (
        <div className="flex flex-1 relative w-full">
          <div className="absolute inset-0">
            <CodeEditor {...commonProps} onSaveContent={() => {}} />
          </div>
        </div>
      ) : document.kind === 'sheet' ? (
        <div className="flex flex-1 relative size-full p-4">
          <div className="absolute inset-0">
            <SpreadsheetEditor {...commonProps} />
          </div>
        </div>
      ) : document.kind === 'image' ? (
        <ImageEditor
          title={document.title}
          content={document.content ?? ''}
          isCurrentVersion={true}
          currentVersionIndex={0}
          status={artifact.status}
          isInline={true}
        />
      ) : document.kind === 'chart' ? (
        renderChartPreview()
      ) : null}
    </div>
  );
};
