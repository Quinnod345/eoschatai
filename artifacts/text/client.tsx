import { Artifact } from '@/components/create-artifact';
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
} from '@/components/icons';
import type { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
// Document library will be imported dynamically

interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
}

export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
  kind: 'text',
  description: 'Useful for text content, like drafting essays and emails.',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    setMetadata({
      suggestions,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
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
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + (streamPart.content as string),
          isVisible:
            draftArtifact.status === 'streaming' &&
            draftArtifact.content.length > 400 &&
            draftArtifact.content.length < 450
              ? true
              : draftArtifact.isVisible,
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
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
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
            Document,
            Packer,
            Paragraph,
            TextRun,
            HeadingLevel,
            AlignmentType,
            UnderlineType,
            ExternalHyperlink,
          } = await import('docx');
          const marked = await import('marked');

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
                    text: token.text,
                    heading: `Heading${level}` as HeadingLevel,
                    spacing: { before: 200, after: 200 },
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
                  elements.push(
                    new Paragraph({
                      text: token.text,
                      spacing: { before: 120, after: 120 },
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

                  elements.push(
                    new Paragraph({
                      text: prefix + itemText,
                      indent: { left: 720 }, // 0.5 inch indent
                      spacing: { before: 100, after: 100 },
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
                      bottom: { color: '#CCCCCC', size: 1, style: 'single' },
                    },
                    spacing: { before: 120, after: 120 },
                  }),
                );
              } else if (token.type === 'space') {
                // Handle spaces
                elements.push(new Paragraph(''));
              }
            }

            return elements;
          };

          // Create inline elements (bold, italic, etc.)
          const createInlineElements = (tokens: any[]) => {
            if (!tokens) return [new TextRun('')];

            const elements: any[] = [];

            for (const token of tokens) {
              if (token.type === 'text') {
                elements.push(new TextRun(token.text));
              } else if (token.type === 'strong') {
                elements.push(new TextRun({ text: token.text, bold: true }));
              } else if (token.type === 'em') {
                elements.push(new TextRun({ text: token.text, italics: true }));
              } else if (token.type === 'codespan') {
                elements.push(
                  new TextRun({
                    text: token.text,
                    font: 'Courier New',
                    size: 24,
                  }),
                );
              } else if (token.type === 'del') {
                elements.push(new TextRun({ text: token.text, strike: true }));
              } else if (token.type === 'link') {
                elements.push(
                  new ExternalHyperlink({
                    children: [
                      new TextRun({ text: token.text, style: 'Hyperlink' }),
                    ],
                    link: token.href || '',
                  }),
                );
              } else if (token.type === 'image') {
                // Images are not supported in this basic version
                elements.push(new TextRun({ text: `[Image: ${token.text}]` }));
              } else {
                // Fallback for any other token types
                elements.push(new TextRun(token.raw || ''));
              }
            }

            return elements;
          };

          // Create a new document with the parsed markdown
          const doc = new Document({
            title: title,
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
            // Use the artifact title for the filename, with fallback
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
