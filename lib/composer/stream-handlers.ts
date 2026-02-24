import type { Dispatch, SetStateAction } from 'react';
import type { UIComposer } from '@/components/composer';
import type { DataStreamDelta } from '@/components/data-stream-handler';
import type { ComposerKind } from '@/lib/mentions/types';

type StreamHandlerArgs = {
  streamPart: DataStreamDelta;
  setComposer: Dispatch<SetStateAction<UIComposer>>;
  setMetadata: Dispatch<SetStateAction<any>>;
};

type StreamHandler = (args: StreamHandlerArgs) => void;

function textStreamHandler({
  streamPart,
  setMetadata,
  setComposer,
}: StreamHandlerArgs) {
  if (streamPart.type === 'suggestion') {
    setMetadata((metadata: any) => ({
      suggestions: [...(metadata?.suggestions || []), streamPart.content],
    }));
  }

  if (streamPart.type === 'text-delta') {
    setComposer((draft) => {
      const delta = String(streamPart.content || '');
      const alreadyHasDelta = delta.length > 0 && draft.content.endsWith(delta);
      const nextContent = alreadyHasDelta
        ? draft.content
        : draft.content + delta;
      return {
        ...draft,
        content: nextContent,
        isVisible:
          draft.status === 'streaming' &&
          draft.content.length > 400 &&
          draft.content.length < 450
            ? true
            : draft.isVisible,
        status: 'streaming',
      };
    });
  }
}

function codeStreamHandler({ streamPart, setComposer }: StreamHandlerArgs) {
  if (streamPart.type === 'code-delta') {
    setComposer((draft) => ({
      ...draft,
      content: streamPart.content as string,
      isVisible:
        draft.status === 'streaming' &&
        draft.content.length > 300 &&
        draft.content.length < 310
          ? true
          : draft.isVisible,
      status: 'streaming',
    }));
  }
}

function sheetStreamHandler({ streamPart, setComposer }: StreamHandlerArgs) {
  if (streamPart.type === 'sheet-delta') {
    setComposer((draft) => ({
      ...draft,
      content: streamPart.content as string,
      isVisible: true,
      status: 'streaming',
    }));
  }
}

function imageStreamHandler({ streamPart, setComposer }: StreamHandlerArgs) {
  if ((streamPart as any).type === 'image-gallery') {
    setComposer((draft) => ({
      ...draft,
      content: String((streamPart as any).content || ''),
      isVisible: true,
      status: 'streaming',
    }));
    return;
  }
  if (streamPart.type === 'image-delta') {
    setComposer((draft) => ({
      ...draft,
      content: streamPart.content as string,
      isVisible: true,
      status: 'streaming',
    }));
  }
}

function chartStreamHandler({
  streamPart,
  setMetadata,
  setComposer,
}: StreamHandlerArgs) {
  if (streamPart.type === 'text-delta') {
    try {
      const contentStr = streamPart.content as string;

      let parsedChartData: any = null;
      const hasBeginMarker = contentStr.includes('CHART_DATA_BEGIN');
      const hasEndMarker = contentStr.includes('CHART_DATA_END');

      if (hasBeginMarker && hasEndMarker) {
        try {
          const startIndex =
            contentStr.indexOf('CHART_DATA_BEGIN') + 'CHART_DATA_BEGIN'.length;
          const endIndex = contentStr.indexOf('CHART_DATA_END');
          if (startIndex >= 0 && endIndex > startIndex) {
            const jsonStr = contentStr.substring(startIndex, endIndex).trim();
            parsedChartData = JSON.parse(jsonStr);
          }
        } catch {
          /* partial JSON during streaming */
        }
      } else if (
        contentStr.trim().startsWith('{') &&
        contentStr.includes('"type"')
      ) {
        try {
          const jsonStartIndex = contentStr.indexOf('{');
          const jsonEndIndex = contentStr.lastIndexOf('}') + 1;
          if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
            parsedChartData = JSON.parse(
              contentStr.substring(jsonStartIndex, jsonEndIndex),
            );
          }
        } catch {
          /* partial JSON during streaming */
        }
      }

      if (parsedChartData) {
        const isValid =
          parsedChartData.type &&
          parsedChartData.data &&
          Array.isArray(parsedChartData.data) &&
          parsedChartData.data.length > 0;

        if (isValid) {
          setMetadata((metadata: any) => ({
            ...metadata,
            chartData: parsedChartData,
          }));
        }
      }

      setComposer((draft) => ({
        ...draft,
        content: draft.content + (streamPart.content as string),
        isVisible:
          draft.status === 'streaming' && draft.content.length > 50
            ? true
            : draft.isVisible,
        status: 'streaming',
      }));
    } catch {
      /* error handling stream part */
    }
  }
}

function parseVtoJson(content: string | undefined): any | null {
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
    const parsed = JSON.parse(jsonStr);
    return parsed || null;
  } catch {
    return null;
  }
}

function parseACJson(content: string | undefined): any | null {
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
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !parsed.root) return null;
    if (typeof parsed.version !== 'number') parsed.version = 1;
    if (!parsed.title) parsed.title = 'Accountability Chart';
    return parsed;
  } catch {
    return null;
  }
}

function vtoStreamHandler({
  streamPart,
  setMetadata,
  setComposer,
}: StreamHandlerArgs) {
  if (streamPart.type === 'text-delta') {
    const content = String(streamPart.content || '');
    const parsed = parseVtoJson(content);
    if (parsed) {
      setMetadata((m: any) => ({ ...(m || {}), vto: parsed }));
    }
    setComposer((draft) => ({
      ...draft,
      content,
      isVisible:
        draft.status === 'streaming' && content.length > 200
          ? true
          : draft.isVisible,
      status: 'streaming',
    }));
  }
}

function accountabilityStreamHandler({
  streamPart,
  setMetadata,
  setComposer,
}: StreamHandlerArgs) {
  if (streamPart.type === 'text-delta') {
    const content = String(streamPart.content || '');
    const parsed = parseACJson(content);
    if (parsed) {
      setMetadata((m: any) => ({ ...(m || {}), ac: parsed }));
    }
    setComposer((draft) => ({
      ...draft,
      title:
        parsed?.title && parsed.title !== draft.title
          ? (parsed.title as string)
          : draft.title,
      content,
      isVisible:
        draft.status === 'streaming' && content.length > 120
          ? true
          : draft.isVisible,
      status: 'streaming',
    }));
  }
}

const streamHandlerMap: Record<string, StreamHandler> = {
  text: textStreamHandler,
  code: codeStreamHandler,
  sheet: sheetStreamHandler,
  image: imageStreamHandler,
  chart: chartStreamHandler,
  vto: vtoStreamHandler,
  accountability: accountabilityStreamHandler,
};

export function getStreamHandler(
  kind: ComposerKind | string,
): StreamHandler | undefined {
  return streamHandlerMap[kind];
}
