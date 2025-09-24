import { Composer } from '@/components/create-composer';
import { DiffView } from '@/components/diffview';
import { DocumentSkeleton } from '@/components/document-skeleton';
import { Editor } from '@/components/text-editor';
import {
  ClockRewind,
  CopyIcon,
  DownloadIcon,
  MessageIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
  BrainIcon,
  MinusIcon,
  PlusIcon,
} from '@/components/icons';
import type { Suggestion } from '@/lib/db/schema';
import { toast } from '@/lib/toast-system';
import { getSuggestions } from '../actions';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
// Document library will be imported dynamically

interface TextComposerMetadata {
  suggestions: Array<Suggestion>;
}

export const textComposer = new Composer<'text', TextComposerMetadata>({
  kind: 'text',
  description:
    'Useful for document content (notes, outlines, articles, SOPs). Renders Markdown.',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    setMetadata({
      suggestions,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setComposer }) => {
    if (streamPart.type === 'suggestion') {
      setMetadata((metadata) => {
        return {
          suggestions: [
            ...metadata.suggestions,
            streamPart.content as Suggestion,
          ],
        };
      });
    }

    if (streamPart.type === 'text-delta') {
      setComposer((draftComposer) => {
        const delta = String(streamPart.content || '');
        // Allow overlapping chunks; only skip if exact suffix duplication
        const alreadyHasDelta =
          delta.length > 0 && draftComposer.content.endsWith(delta);
        const nextContent = alreadyHasDelta
          ? draftComposer.content
          : draftComposer.content + delta;

        return {
          ...draftComposer,
          content: nextContent,
          isVisible:
            draftComposer.status === 'streaming' &&
            draftComposer.content.length > 400 &&
            draftComposer.content.length < 450
              ? true
              : draftComposer.isVisible,
          status: 'streaming',
        };
      });
    }
  },
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
    documentId,
    title,
  }) => {
    const { data: session } = useSession();
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    if (isLoading) {
      return <DocumentSkeleton composerKind="text" />;
    }

    if (mode === 'diff') {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    return (
      <>
        <div className="flex flex-row py-8 md:p-20 px-4">
          <Editor
            content={content}
            suggestions={metadata ? metadata.suggestions : []}
            isCurrentVersion={isCurrentVersion}
            currentVersionIndex={currentVersionIndex}
            status={status}
            onSaveContent={onSaveContent}
            documentId={documentId}
            userId={session?.user?.id}
            title={title}
            kind="text"
            onHistoryChange={(undo, redo) => {
              setCanUndo(undo);
              setCanRedo(redo);
            }}
          />

          {metadata?.suggestions?.length > 0 ? (
            <div className="md:hidden h-dvh w-12 shrink-0" />
          ) : null}
        </div>
      </>
    );
  },
  actions: [
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      isDisabled: ({ currentVersionIndex, setMetadata }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'Undo',
      onClick: async () => {
        // This will be handled by the document history hook in the Editor
        const event = new CustomEvent('document-undo');
        window.dispatchEvent(event);
      },
      isDisabled: () => {
        // Check if undo is available from the document history state
        const undoState = (window as any).__documentHistoryState;
        return !undoState?.canUndo;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'Redo',
      onClick: async () => {
        // This will be handled by the document history hook in the Editor
        const event = new CustomEvent('document-redo');
        window.dispatchEvent(event);
      },
      isDisabled: () => {
        // Check if redo is available from the document history state
        const redoState = (window as any).__documentHistoryState;
        return !redoState?.canRedo;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download as .docx',
      onClick: async ({ content, title }) => {
        try {
          // Dynamically import docx and marked to avoid SSR issues
          const {
            Table,
            TableRow,
            TableCell,
            WidthType,
            Document,
            Packer,
            Paragraph,
            TextRun,
            HeadingLevel,
            AlignmentType,
            UnderlineType,
            ExternalHyperlink,
            LevelFormat,
          } = await import('docx');
          const marked = await import('marked');

          // Enable GFM (GitHub Flavored Markdown) for table support
          marked.setOptions({
            gfm: true,
            breaks: false,
          });

          // Parse markdown to get tokens
          const tokens = marked.lexer(content);

          // Function to create paragraphs from markdown tokens
          const createDocxElements = (tokens: any[]) => {
            const elements: any[] = [];

            for (const token of tokens) {
              if (token.type === 'heading') {
                // Handle headings (h1, h2, h3, etc.)
                const level = token.depth;
                elements.push(
                  new Paragraph({
                    children: createInlineElements(
                      token.tokens ?? [{ type: 'text', text: token.text }],
                    ),
                    heading:
                      `Heading${level}` as (typeof HeadingLevel)[keyof typeof HeadingLevel],
                    spacing: { before: 90, after: 60 },
                  }),
                );
              } else if (token.type === 'paragraph') {
                // Handle paragraphs with inline formatting
                if (typeof token.tokens !== 'undefined') {
                  const inlineElements = createInlineElements(token.tokens);
                  elements.push(
                    new Paragraph({
                      children: inlineElements,
                      spacing: { before: 120, after: 120 },
                    }),
                  );
                } else {
                  const textParts = String(token.text || '').split(/\n/);
                  const paragraphChildren: any[] = [];
                  for (let i = 0; i < textParts.length; i++) {
                    paragraphChildren.push(new TextRun(textParts[i]));
                    if (i < textParts.length - 1) {
                      paragraphChildren.push(new TextRun({ break: 1 }));
                    }
                  }
                  elements.push(
                    new Paragraph({
                      children: paragraphChildren,
                      spacing: { before: 60, after: 60 },
                    }),
                  );
                }
              } else if (token.type === 'list') {
                // Handle lists (bullet points or numbered)
                const listItems = token.items || [];
                for (let i = 0; i < listItems.length; i++) {
                  const item = listItems[i];
                  const prefix = token.ordered ? `${i + 1}. ` : '• ';

                  let itemText = item.text;
                  if (typeof item.tokens !== 'undefined') {
                    // If there are inline tokens, get the raw text
                    itemText = item.tokens
                      .map((t: any) =>
                        t.type === 'text' ? t.text : t.raw || '',
                      )
                      .join('');
                  }

                  const runs = item.tokens
                    ? createInlineElements(item.tokens)
                    : [new TextRun(item.text || '')];
                  elements.push(
                    new Paragraph({
                      children: runs,
                      numbering: token.ordered
                        ? { reference: 'ol', level: 0 }
                        : undefined,
                      bullet: token.ordered ? undefined : { level: 0 },
                      spacing: { before: 30, after: 30 },
                    }),
                  );
                }
              } else if (token.type === 'code') {
                // Handle code blocks
                elements.push(
                  new Paragraph({
                    text: token.text,
                    style: 'Code',
                    spacing: { before: 120, after: 120 },
                    indent: { left: 720 },
                    border: {
                      top: { color: '#CCCCCC', size: 1, style: 'single' },
                      bottom: { color: '#CCCCCC', size: 1, style: 'single' },
                      left: { color: '#CCCCCC', size: 1, style: 'single' },
                      right: { color: '#CCCCCC', size: 1, style: 'single' },
                    },
                  }),
                );
              } else if (token.type === 'blockquote') {
                // Handle blockquotes
                elements.push(
                  new Paragraph({
                    text: token.text,
                    indent: { left: 720 },
                    border: {
                      left: { color: '#CCCCCC', size: 3, style: 'single' },
                    },
                    spacing: { before: 120, after: 120 },
                  }),
                );
              } else if (token.type === 'hr') {
                // Handle horizontal rules
                elements.push(
                  new Paragraph({
                    text: '',
                    border: {
                      bottom: { color: '#999999', size: 12, style: 'single' },
                    },
                    spacing: { before: 60, after: 60 },
                  }),
                );
              } else if (token.type === 'table') {
                // Handle tables
                const tableRows = [];

                // Add header row if present
                if (token.header && token.header.length > 0) {
                  const headerCells = token.header.map(
                    (headerCell: any) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: createInlineElements(
                              headerCell.tokens ?? [
                                { type: 'text', text: headerCell.text || '' },
                              ],
                              { bold: true },
                            ),
                          }),
                        ],
                      }),
                  );
                  tableRows.push(new TableRow({ children: headerCells }));
                }

                // Add data rows
                if (token.rows && token.rows.length > 0) {
                  for (const row of token.rows) {
                    const cells = row.map(
                      (cell: any) =>
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: createInlineElements(
                                cell.tokens ?? [
                                  { type: 'text', text: cell.text || '' },
                                ],
                              ),
                            }),
                          ],
                        }),
                    );
                    tableRows.push(new TableRow({ children: cells }));
                  }
                }

                if (tableRows.length > 0) {
                  elements.push(
                    new Table({
                      rows: tableRows,
                    }),
                  );
                  // Add spacing paragraph after table
                  elements.push(
                    new Paragraph({ text: '', spacing: { after: 120 } }),
                  );
                }
              } else if (token.type === 'space') {
                // Handle spaces
                elements.push(new Paragraph(''));
              }
            }

            return elements;
          };

          // Create inline elements (bold, italic, etc.)
          const createInlineElements = (
            tokens: any[],
            overlay: {
              bold?: boolean;
              italics?: boolean;
              strike?: boolean;
            } = {},
          ) => {
            if (!tokens) return [new TextRun('')];

            const elements: any[] = [];

            const pushTextWithBreaks = (text: string) => {
              const parts = String(text || '').split(/\n/);
              for (let i = 0; i < parts.length; i++) {
                elements.push(
                  new TextRun({
                    text: parts[i],
                    bold: overlay.bold,
                    italics: overlay.italics,
                    strike: overlay.strike,
                  }),
                );
                if (i < parts.length - 1)
                  elements.push(new TextRun({ break: 1 }));
              }
            };

            for (const t of tokens) {
              if (t.type === 'text') {
                pushTextWithBreaks(t.text);
              } else if (t.type === 'strong') {
                const inner = t.tokens ?? [{ type: 'text', text: t.text }];
                elements.push(
                  ...createInlineElements(inner, { ...overlay, bold: true }),
                );
              } else if (t.type === 'em') {
                const inner = t.tokens ?? [{ type: 'text', text: t.text }];
                elements.push(
                  ...createInlineElements(inner, { ...overlay, italics: true }),
                );
              } else if (t.type === 'del') {
                const inner = t.tokens ?? [{ type: 'text', text: t.text }];
                elements.push(
                  ...createInlineElements(inner, { ...overlay, strike: true }),
                );
              } else if (t.type === 'codespan') {
                // Render code span without overlay styles
                elements.push(
                  new TextRun({
                    text: t.text || '',
                    font: 'Courier New',
                    size: 24,
                  }),
                );
              } else if (t.type === 'link') {
                const inner = t.tokens ?? [{ type: 'text', text: t.text }];
                const children = createInlineElements(inner, overlay);
                elements.push(
                  new ExternalHyperlink({ children, link: t.href || '' }),
                );
              } else if (t.type === 'image') {
                elements.push(
                  new TextRun({ text: `[Image: ${t.text || ''}]` }),
                );
              } else {
                pushTextWithBreaks(t.raw || t.text || '');
              }
            }

            return elements;
          };

          // Create a new document with the parsed markdown
          const doc = new Document({
            title: title,
            numbering: {
              config: [
                {
                  reference: 'ol',
                  levels: [
                    {
                      level: 0,
                      format: LevelFormat.DECIMAL,
                      text: '%1.',
                      alignment: AlignmentType.START,
                    },
                  ],
                },
              ],
            },
            sections: [
              {
                properties: {},
                children: createDocxElements(tokens),
              },
            ],
          });

          // Generate the DOCX document
          Packer.toBlob(doc).then((blob) => {
            // Create a download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Use the composer title for the filename, with fallback
            const safeTitle =
              title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'document';
            a.download = `${safeTitle}.docx`;
            document.body.appendChild(a);
            a.click();

            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Downloaded "${title}" as Word document`);
          });
        } catch (error) {
          console.error('Error creating Word document:', error);
          toast.error('Failed to create Word document');
        }
      },
    },
  ],
  toolbar: [
    {
      icon: <PenIcon />,
      description: 'Add final polish',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.',
        });
      },
    },
    {
      icon: <BrainIcon />,
      description: 'Make more professional',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please rewrite the current document to be more professional and polished while preserving meaning and structure.',
        });
      },
    },
    {
      icon: <MinusIcon />,
      description: 'Shorten (concise)',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please make the current document shorter and more concise, removing redundancy but keeping key points.',
        });
      },
    },
    {
      icon: <PlusIcon />,
      description: 'Lengthen (expand)',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please expand the current document where appropriate with more detail, examples, and clearer transitions.',
        });
      },
    },
    {
      icon: <MessageIcon />,
      description: 'Request suggestions',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please add suggestions you have that could improve the writing.',
        });
      },
    },
  ],
});
