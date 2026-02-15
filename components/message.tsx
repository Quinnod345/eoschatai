import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import React, { memo, useState, useMemo, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, AILoaderIcon, AIActiveLoaderIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { SimpleMessageEditor } from './simple-message-editor';
import { DocumentPreview } from './document-preview';
import { ReplyContext } from './reply-context';
import GlassSurface from './GlassSurface';
import type { ChatHelpers, ReloadFunction } from './multimodal-input/types';
import { TranslationUI } from './translation-ui';
import { SmoothMarkdown } from './smooth-markdown';
import {
  Calendar,
  FileText,
  Users,
  Mic,
  Clock,
  MessageSquare,
  Lightbulb,
  ChevronDown,
} from 'lucide-react';
import type { SearchProgress } from '@/hooks/use-web-search-progress';
import { ErrorBoundary } from './error-boundary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { EmbeddedContent } from '@/types/upload-content';
import {
  extractEmbeddedContent,
  normalizeToolResultToEmbeddedContents,
  convertLegacyPDFFormat,
  convertLegacyDocumentFormat,
  convertLegacyImageFormat,
} from '@/types/upload-content';

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

// Extend UIMessage type to include provider
// AI SDK 5: content is now in parts, experimental_attachments replaced with file parts
interface ExtendedUIMessage extends UIMessage {
  provider?: string;
  // AI SDK 5 compatibility: these properties may not exist on UIMessage
  content?: string;
  experimental_attachments?: Array<{ name?: string; contentType?: string; url: string }>;
}

// AI SDK 5: Helper to extract text content from message parts
function getMessageContent(message: ExtendedUIMessage): string {
  if (message.content) return message.content;
  if (!message.parts) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

// AI SDK 5: Helper to extract attachments from message (file parts)
function getMessageAttachments(message: ExtendedUIMessage): Array<{ name?: string; contentType?: string; url: string }> {
  if (message.experimental_attachments) return message.experimental_attachments;
  if (!message.parts) return [];
  return message.parts
    .filter((p: any) => p.type === 'file' && p.url)
    .map((p: any) => ({ name: p.name, contentType: p.mediaType || p.mimeType, url: p.url }));
}

interface PDFContent {
  name: string;
  pageCount: number;
}

interface DocumentContent {
  name: string;
  type: 'Word Document' | 'Spreadsheet' | 'Presentation';
  pageCount?: number;
}

interface ImageAnalysis {
  name: string;
  description: string;
  hasText: boolean;
}

// Regular expression to extract PDF metadata from message text
const PDF_CONTENT_REGEX =
  /===\s+PDF\s+Content\s+from\s+([^\(]+)\s+\((\d+)\s+pages\)\s+===\n(?:\[INLINE UPLOAD[^\]]*\]\n)?([\s\S]*?)(?=\n\n===\s+End\s+of\s+PDF\s+Content\s+===|\n*$)/gi;

// Regular expression to extract document content
const DOC_CONTENT_REGEX =
  /===\s+(Word Document|Spreadsheet)\s+Content\s+from\s+([^=]+?)(?:\s+\((\d+)\s+pages?\))?\s+===\n(?:\[INLINE UPLOAD[^\]]*\]\n)?([\s\S]*?)(?:===\s+End\s+of\s+(?:Word Document|Spreadsheet)\s+Content\s+===)/gi;

// Regular expression to extract image analysis
const IMAGE_ANALYSIS_REGEX =
  /===\s+Image\s+Analysis\s+for\s+([^\n]+)\s+===\s*\n(?:\[INLINE UPLOAD[^\]]*\]\n)?Description:\s+([^\n]+)(?:\s*\n+Extracted\s+Text:\s+([^\n=]*))?([\s\S]*?)(?=\n\n===\s+End\s+of\s+Image\s+Analysis\s+===|\n*$)/gi;

// Regular expression to extract audio transcripts (legacy format)
const AUDIO_TRANSCRIPT_REGEX =
  /===\s+Audio\s+Transcript\s+from\s+([^\n]+)\s+===\n([\s\S]*?)(?:===\s+End\s+of\s+Audio\s+Transcript\s+===)/gi;

// Add regex for mention detection (supports types like document/recording)
const MENTION_REGEX = /@(\w+):([^\s]+)/g;

// Function to extract PDF content markers from text and return both PDFs and cleaned text
function extractPDFContent(text: string): {
  pdfs: PDFContent[];
  cleanedText: string;
} {
  const pdfs: PDFContent[] = [];

  // Find all PDF content markers in the text
  let match: RegExpExecArray | null = PDF_CONTENT_REGEX.exec(text);

  while (match !== null) {
    // Extract name and page count from regex match
    const name = match[1].trim();
    const pageCount = Number.parseInt(match[2], 10);

    pdfs.push({ name, pageCount });

    // Get the next match
    match = PDF_CONTENT_REGEX.exec(text);
  }

  // Remove the PDF content sections from the text
  let cleanedText = text;
  if (pdfs.length > 0) {
    // Remove PDF content sections completely, including inline upload markers and headers
    cleanedText = text.replace(
      /📎\s*\*\*INLINE DOCUMENT UPLOADS\*\*[^\n]*\n*/gi,
      '',
    );
    cleanedText = cleanedText.replace(
      /===\s+PDF\s+Content\s+from\s+[^\(]+\s+\(\d+\s+pages\)\s+===\n(?:\[INLINE UPLOAD[^\]]*\]\n)?[\s\S]*?(?:===\s+End\s+of\s+PDF\s+Content\s+===)?\n*/gi,
      '',
    );
    // Clean up any leftover whitespace
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
  }

  return { pdfs, cleanedText };
}

// Function to extract document content
function extractDocumentContent(text: string): {
  documents: DocumentContent[];
  cleanedText: string;
} {
  const documents: DocumentContent[] = [];

  // Reset regex state
  DOC_CONTENT_REGEX.lastIndex = 0;

  // Find all document content markers in the text
  let match: RegExpExecArray | null = DOC_CONTENT_REGEX.exec(text);

  while (match !== null) {
    // Extract document type, name and optional page count
    const type = match[1].trim() as 'Word Document' | 'Spreadsheet';
    const name = match[2].trim();
    const pageCount = match[3] ? Number.parseInt(match[3], 10) : undefined;

    documents.push({ name, type, pageCount });

    // Get the next match
    match = DOC_CONTENT_REGEX.exec(text);
  }

  // Remove the document content sections from the text
  let cleanedText = text;
  if (documents.length > 0) {
    // Remove document content sections completely, including inline upload markers
    cleanedText = text.replace(
      /📎\s*\*\*INLINE DOCUMENT UPLOADS\*\*[^\n]*\n*/gi,
      '',
    );
    cleanedText = cleanedText.replace(
      /===\s+(Word Document|Spreadsheet)\s+Content\s+from\s+[^\(]+(?:\s+\(\d+\s+pages\))?\s+===\n(?:\[INLINE UPLOAD[^\]]*\]\n)?[\s\S]*?(?:===\s+End\s+of\s+(?:Word Document|Spreadsheet)\s+Content\s+===)?\n*/gi,
      '',
    );
    // Clean up any leftover whitespace
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
  }

  return { documents, cleanedText };
}

// Function to extract image analysis
function extractImageAnalysis(text: string): {
  images: ImageAnalysis[];
  cleanedText: string;
} {
  const images: ImageAnalysis[] = [];

  // Find all image analysis markers in the text
  let match: RegExpExecArray | null = IMAGE_ANALYSIS_REGEX.exec(text);

  while (match !== null) {
    // Extract name, description, and check if there's extracted text
    const name = match[1].trim();
    const description = match[2].trim();
    const extractedText = match[3]?.trim() || '';
    const hasText =
      extractedText !== '' && extractedText !== 'No text detected';

    images.push({ name, description, hasText });

    // Get the next match
    match = IMAGE_ANALYSIS_REGEX.exec(text);
  }

  // Remove the image analysis sections from the text
  let cleanedText = text;
  if (images.length > 0) {
    // Remove image analysis sections completely, including inline upload markers
    cleanedText = text.replace(
      /📎\s*\*\*INLINE DOCUMENT UPLOADS\*\*[^\n]*\n*/gi,
      '',
    );
    cleanedText = cleanedText.replace(
      /===\s+Image\s+Analysis\s+for\s+[^\n]+\s+===\s*\n(?:\[INLINE UPLOAD[^\]]*\]\n)?Description:\s+[^\n]+(?:\s*\n+Extracted\s+Text:\s+[^\n=]*)?([\s\S]*?)(?:===\s+End\s+of\s+Image\s+Analysis\s+===)?\n*/gi,
      '',
    );
    // Clean up any leftover whitespace
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
  }

  return { images, cleanedText };
}

// Function to extract and format mentions within message text
function formatMentionsInText(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  // Find all mentions in the text
  let match: RegExpExecArray | null = MENTION_REGEX.exec(text);

  while (match !== null) {
    const fullMatch = match[0];
    const type = match[1];
    const name = match[2];
    const matchIndex = match.index;

    // Add text before this mention
    if (matchIndex > lastIndex) {
      elements.push(text.substring(lastIndex, matchIndex));
    }

    // Get appropriate icon based on resource type
    let icon = <FileText className="size-3.5" />;
    if (type === 'calendar') {
      icon = <Calendar className="size-3.5" />;
    } else if (type === 'people' || type === 'team' || type === 'user') {
      icon = <Users className="size-3.5" />;
    } else if (type === 'recording') {
      icon = <Mic className="size-3.5" />;
    }

    // Add the formatted mention badge
    elements.push(
      <span
        key={`mention-${type}-${name}-${matchIndex}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100/80 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium border border-blue-200/50 dark:border-blue-800/60 mx-0.5"
      >
        <span className="text-blue-600 dark:text-blue-400">{icon}</span>
        {name}
      </span>,
    );

    // Update the last index
    lastIndex = matchIndex + fullMatch.length;

    // Get next match
    match = MENTION_REGEX.exec(text);
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  chatStatus,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
  onPin,
  onReply,
  isPinned,
  citations,
  searchProgress,
  meetingMetadata,
}: {
  chatId: string;
  message: ExtendedUIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  chatStatus?: string;
  setMessages: ChatHelpers['setMessages'];
  reload: ReloadFunction;
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onPin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  isPinned?: boolean;
  citations?: CitationReference[];
  searchProgress?: SearchProgress;
  meetingMetadata?: any;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Process text parts to extract PDF content and format mentions
  const processedParts = useMemo((): {
    parts: typeof message.parts;
    pdfContents: PDFContent[];
    documentContents: DocumentContent[];
    imageAnalyses: ImageAnalysis[];
    embeddedContents: EmbeddedContent[];
    hasMentions: boolean;
    replyContext: { content: string; role: 'user' | 'assistant' } | null;
  } => {
    // If message.parts is not defined, but message.content is, convert it to parts
    // This handles streaming messages that haven't been persisted to DB yet
    let workingParts = message.parts;

    if (!workingParts && getMessageContent(message)) {
      workingParts = [{ type: 'text' as const, text: getMessageContent(message) }];
    } else if (!workingParts) {
      return {
        parts: [],
        pdfContents: [],
        documentContents: [],
        imageAnalyses: [],
        embeddedContents: [],
        hasMentions: false,
        replyContext: null,
      };
    }

    const pdfContents: PDFContent[] = [];
    const documentContents: DocumentContent[] = [];
    const imageAnalyses: ImageAnalysis[] = [];
    const embeddedContents: EmbeddedContent[] = [];
    let hasMentions = false;
    let replyContext: { content: string; role: 'user' | 'assistant' } | null =
      null;

    // Process each text part to extract structured content
    const parts = workingParts.map((part) => {
      if (part.type === 'text') {
        // First check for reply context (only for the first text part)
        let currentText = part.text;
        if (!replyContext) {
          const replyParseResult = parseReplyContext(part.text);
          if (replyParseResult.hasReply) {
            replyContext = replyParseResult.replyContext || null;
            currentText = replyParseResult.cleanedText;
          }
        }

        // Check for mentions
        if (MENTION_REGEX.test(currentText)) {
          hasMentions = true;
          // Reset regex state
          MENTION_REGEX.lastIndex = 0;
        }

        // Extract all document types in one pass
        let cleanedText = currentText;

        // First, extract new embedded content format
        const { contents: extractedEmbedded, cleanedText: textAfterEmbedded } =
          extractEmbeddedContent(cleanedText);
        embeddedContents.push(...extractedEmbedded);
        cleanedText = textAfterEmbedded;

        // First, extract PDFs
        const { pdfs, cleanedText: afterPDF } = extractPDFContent(cleanedText);
        pdfContents.push(...pdfs);
        cleanedText = afterPDF;
        // Convert PDFs to standardized embedded content
        if (pdfs.length > 0) {
          pdfs.forEach((p) =>
            embeddedContents.push(
              convertLegacyPDFFormat(p.name, p.pageCount, ''),
            ),
          );
        }

        // Then documents
        const { documents, cleanedText: afterDocs } =
          extractDocumentContent(cleanedText);
        documentContents.push(...documents);
        cleanedText = afterDocs;
        if (documents.length > 0) {
          documents.forEach((d) =>
            embeddedContents.push(
              convertLegacyDocumentFormat(d.name, d.type, d.pageCount),
            ),
          );
        }

        // Then images
        const { images, cleanedText: afterImages } =
          extractImageAnalysis(cleanedText);
        imageAnalyses.push(...images);
        cleanedText = afterImages;
        if (images.length > 0) {
          images.forEach((img) =>
            embeddedContents.push(
              convertLegacyImageFormat(img.name, img.description, img.hasText),
            ),
          );
        }

        // Now remove ALL inline upload content in one comprehensive pass
        if (pdfs.length > 0 || documents.length > 0 || images.length > 0) {
          // Remove the inline upload header
          cleanedText = cleanedText.replace(
            /📎\s*\*\*INLINE DOCUMENT UPLOADS\*\*[^\n]*\n+/gi,
            '',
          );

          // Remove all document sections with a more comprehensive regex
          // Make the end marker optional to handle legacy messages without explicit terminators
          cleanedText = cleanedText.replace(
            /===\s+(?:PDF Content from|Word Document Content from|Spreadsheet Content from|Image Analysis for)[^=]+===[\s\S]*?(?:===\s+End of[^=]+===\s*)?/gi,
            '',
          );

          // Extra defensive cleanup for any residual image analysis text blocks
          cleanedText = cleanedText.replace(
            /(?:^|\n)Description:[\s\S]*?(?:===\s*End\s*of\s*Image\s*Analysis\s*===\s*)/gi,
            '',
          );

          // Remove any stray end markers left behind
          cleanedText = cleanedText.replace(
            /===\s*End\s*of\s*(?:PDF\s*Content|Word\s*Document\s*Content|Spreadsheet\s*Content|Image\s*Analysis)\s*===/gi,
            '',
          );

          // Clean up any leftover whitespace
          cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
        }

        // Create a new part with the cleaned text
        return { ...part, text: cleanedText };
      }
      return part;
    });

    return {
      parts,
      pdfContents,
      documentContents,
      imageAnalyses,
      embeddedContents,
      hasMentions,
      replyContext,
    };
  }, [message.parts, message.id]);

  const {
    parts,
    pdfContents,
    documentContents,
    imageAnalyses,
    embeddedContents,
    hasMentions,
    replyContext,
  } = processedParts;

  // Debug logging
  if (
    message.role === 'user' &&
    (pdfContents.length > 0 ||
      documentContents.length > 0 ||
      imageAnalyses.length > 0)
  ) {
    console.log('Message extraction results:', {
      messageId: message.id,
      pdfs: pdfContents,
      documents: documentContents,
      images: imageAnalyses,
      originalLength:
        message.parts?.[0]?.type === 'text'
          ? message.parts[0].text?.length
          : undefined,
      cleanedLength:
        parts?.[0]?.type === 'text' ? parts[0].text?.length : undefined,
    });
  }

  // AI SDK 5: Attachments are now file parts in the parts array
  // The getMessageAttachments helper handles both formats for backward compatibility
  return (
    <AnimatePresence>
      <motion.article
        data-testid={`message-${message.role}`}
        aria-label={`${message.role === 'assistant' ? 'AI' : 'Your'} message`}
        className="w-full mx-auto max-w-3xl px-3 md:px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-[calc(100%-24px)]',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center shrink-0 bg-background">
              <div className="translate-y-px">
                <AILoaderIcon size={40} />
              </div>
            </div>
          )}

          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {/* Removed duplicate per-role inline preview; embedded content renders once below */}

            {/* Show regular attachments */}
            {getMessageAttachments(message).length > 0 && (
                <div className="flex flex-row justify-end">
                  <GlassSurface
                    width="auto"
                    height="auto"
                    borderRadius={12}
                    borderWidth={0.04}
                    brightness={48}
                    opacity={0.92}
                    blur={10}
                    backgroundOpacity={0.1}
                    showInsetShadow={true}
                    insetShadowIntensity={0.35}
                    useFallback={true}
                    className="inline-flex"
                  >
                    <div
                      data-testid={`message-attachments`}
                      className="flex flex-row gap-2 p-2"
                    >
                      {getMessageAttachments(message).map((attachment) => (
                        <PreviewAttachment
                          key={attachment.url}
                          attachment={attachment}
                        />
                      ))}
                    </div>
                  </GlassSurface>
                </div>
              )}

            {/* Show inline upload preview for user messages */}
            {/* (removed) role-specific inline preview: use unified renderer below */}

            {/* Render embedded content (new format) */}
            {embeddedContents.length > 0 && (
              <TranslationUI
                contents={embeddedContents}
                align={message.role === 'user' ? 'end' : 'start'}
              />
            )}

            {/* Render Claude extended thinking (reasoning) if present */}
            {message.role === 'assistant' && (() => {
              // Extract reasoning from message parts
              const reasoningParts = message.parts?.filter(
                (p: any) => p.type === 'reasoning' || p.type === 'thinking'
              ) || [];
              
              let reasoning = '';
              if (reasoningParts.length > 0) {
                reasoning = reasoningParts
                  .map((p: any) => p.text || p.thinking || p.reasoning || p.content || '')
                  .filter(Boolean)
                  .join('\n\n');
              }
              
              // Also check providerMetadata for Anthropic thinking
              if (!reasoning && (message as any).experimental_providerMetadata?.anthropic?.thinking) {
                reasoning = (message as any).experimental_providerMetadata.anthropic.thinking;
              }
              
              // Check top-level reasoning property
              if (!reasoning && (message as any).reasoning) {
                reasoning = (message as any).reasoning;
              }

              // Check if the response text has started streaming (reasoning is done)
              const textParts = message.parts?.filter((p: any) => p.type === 'text') || [];
              const hasTextContent = textParts.some((p: any) => p.text && p.text.trim().length > 0);
              
              return reasoning ? (
                <ReasoningSection 
                  reasoningContent={reasoning} 
                  isResponseStreaming={hasTextContent}
                />
              ) : null;
            })()}

            {/* Render reasoning text if present (GPT-5 thinking) */}
            {message.role === 'assistant' &&
              (message as any).experimental_providerMetadata?.openai
                ?.reasoningText && (
                <div className="flex flex-col gap-2 p-4 bg-muted/50 rounded-lg border border-muted">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <AIActiveLoaderIcon size={16} />
                    <span>Reasoning</span>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                    {
                      (message as any).experimental_providerMetadata.openai
                        .reasoningText
                    }
                  </div>
                </div>
              )}

            {parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'text') {
                if (mode === 'view') {
                  // Check if this is a meeting transcript
                  const transcriptInfo = isMeetingTranscript(part.text);

                  if (transcriptInfo.isTranscript && message.role === 'user') {
                    // Render meeting transcript with special UI
                    return (
                      <div
                        key={key}
                        className="flex flex-row gap-2 items-start justify-end"
                      >
                        {!isReadonly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setMode('edit')}
                            aria-label="Edit message"
                          >
                            <PencilEditIcon />
                          </Button>
                        )}

                        <MeetingTranscriptCard
                          speakers={
                            meetingMetadata?.speakers ||
                            transcriptInfo.speakers ||
                            1
                          }
                          summary={
                            meetingMetadata?.summary || transcriptInfo.summary
                          }
                          duration={meetingMetadata?.duration}
                          createdAt={meetingMetadata?.createdAt}
                          meetingMetadata={meetingMetadata}
                          fullTranscript={transcriptInfo.fullTranscript}
                        />
                      </div>
                    );
                  }

                  // Check if the text contains mentions that need formatting
                  const containsMentions = MENTION_REGEX.test(part.text);
                  // Reset regex state
                  MENTION_REGEX.lastIndex = 0;

                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setMode('edit')}
                          aria-label="Edit message"
                        >
                          <PencilEditIcon />
                        </Button>
                      )}
                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-4', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl shadow-lg shadow-primary/50':
                            message.role === 'user',
                        })}
                      >
                        {/* Show reply context if present */}
                        {replyContext?.role && replyContext?.content && (
                          <ReplyContext
                            role={replyContext.role}
                            content={replyContext.content}
                          />
                        )}

                        {containsMentions ? (
                          // Custom rendering for text with mentions
                          <div className="prose dark:prose-invert prose-sm max-w-none">
                            {formatMentionsInText(sanitizeText(part.text)).map(
                              (node, i) => (
                                <React.Fragment
                                  key={`mention-fragment-${message.id}-${i}`}
                                >
                                  {node}
                                </React.Fragment>
                              ),
                            )}
                          </div>
                        ) : (
                          // Regular markdown rendering for text without mentions
                          <SmoothMarkdown
                            citations={citations}
                            isStreaming={
                              isLoading &&
                              message.role === 'assistant' &&
                              index === parts.length - 1
                            }
                          >
                            {sanitizeText(part.text)}
                          </SmoothMarkdown>
                        )}
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <AnimatePresence mode="wait" key={key}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-row gap-2 items-start"
                      >
                        <div className="size-8" />

                        <SimpleMessageEditor
                          key={message.id}
                          message={message}
                          setMode={setMode}
                          setMessages={setMessages}
                          reload={reload}
                        />
                      </motion.div>
                    </AnimatePresence>
                  );
                }
              }

              // AI SDK 5: Tool parts are now type: `tool-${toolName}` with properties directly on part
              // Handle both old format (tool-invocation) and new format (tool-*)
              if (type === 'tool-invocation' || type.startsWith('tool-')) {
                // Extract tool info from either format
                const toolPart = part as any;
                const toolInvocation = toolPart.toolInvocation;
                const toolName = toolInvocation?.toolName || type.replace('tool-', '');
                const toolCallId = toolInvocation?.toolCallId || toolPart.toolCallId;
                const state = toolInvocation?.state || toolPart.state;
                const args = toolInvocation?.args || toolPart.input;
                const result = toolInvocation?.result || toolPart.output;

                // AI SDK 5: Handle loading states
                // - 'call' (v4) / 'input-streaming' (v5) - input being streamed
                // - 'input-available' (v5) - input complete, tool executing
                if (state === 'call' || state === 'input-streaming' || state === 'input-available') {
                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview isReadonly={isReadonly} args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : null}
                    </div>
                  );
                }

                // AI SDK 5: Handle error state
                if (state === 'output-error') {
                  const errorText = toolPart.errorText || 'Tool execution failed';
                  return (
                    <div key={toolCallId} className="text-destructive text-sm">
                      Error in {toolName}: {errorText}
                    </div>
                  );
                }

                // AI SDK 5: Handle success states
                // - 'result' (v4) / 'output-available' (v5)
                if (state === 'result' || state === 'output-available') {
                  // Filter out searchWeb tool results - citations are shown inline instead
                  if (toolName === 'searchWeb') {
                    return null;
                  }

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult result={result} />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult result={result} />
                      ) : (
                        (() => {
                          const normalized =
                            normalizeToolResultToEmbeddedContents(
                              toolName,
                              result,
                            );
                          if (!normalized || normalized.length === 0)
                            return null;
                          return (
                            <TranslationUI
                              contents={normalized}
                              align={message.role === 'user' ? 'end' : 'start'}
                            />
                          );
                        })()
                      )}
                    </div>
                  );
                }
              }

              if ((part as any).type === 'recording') {
                const rec = part as any;
                return (
                  <div key={key} className="flex flex-row gap-2 items-start">
                    <div className="flex items-center justify-center size-8 rounded-full bg-purple-500/20 text-purple-600 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="size-4"
                      >
                        <path d="M12 1.75a3.25 3.25 0 0 0-3.25 3.25v7a3.25 3.25 0 0 0 6.5 0v-7A3.25 3.25 0 0 0 12 1.75Z" />
                        <path d="M6.5 10.25a.75.75 0 0 0-1.5 0 7 7 0 0 0 6.25 6.97v2.03H8a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5h-3.25v-2.03A7 7 0 0 0 19 10.25a.75.75 0 0 0-1.5 0 5.5 5.5 0 0 1-11 0Z" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-2 bg-muted px-3 py-2 rounded-xl max-w-full">
                      <div className="text-sm font-medium text-muted-foreground">
                        Voice Recording ({rec.meta?.speakers || 1} speaker
                        {rec.meta?.speakers === 1 ? '' : 's'})
                      </div>
                      <details className="text-sm whitespace-pre-wrap break-words">
                        <summary className="cursor-pointer select-none">
                          Transcript
                        </summary>
                        {rec.text}
                      </details>
                    </div>
                  </div>
                );
              }
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
                chatStatus={chatStatus}
                onPin={onPin}
                onReply={onReply}
                onEdit={() => setMode('edit')}
                isPinned={isPinned}
                citations={citations}
              />
            )}
          </div>
        </div>
      </motion.article>
    </AnimatePresence>
  );
};

const MemoizedPreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    // Re-render when pin status changes so tooltip and icon update immediately
    if (prevProps.isPinned !== nextProps.isPinned) return false;
    // Re-render when chat status changes so children (MessageActions, badge)
    // receive the updated prop (e.g. streaming -> ready transition).
    if (prevProps.chatStatus !== nextProps.chatStatus) return false;

    return true;
  },
);

// Wrap PreviewMessage with error boundary to prevent a single message from crashing the chat
export const PreviewMessage: React.FC<
  Parameters<typeof PurePreviewMessage>[0]
> = (props) => (
  <ErrorBoundary
    context="Message"
    fallback={(error, reset) => (
      <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 my-2">
        <p className="text-sm text-muted-foreground">
          Failed to render message.
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-primary hover:underline mt-2"
        >
          Try again
        </button>
      </div>
    )}
  >
    <MemoizedPreviewMessage {...props} />
  </ErrorBoundary>
);

// Phrases that cycle for reasoning section
const REASONING_PHRASES = [
  'Analyzing',
  'Considering',
  'Reasoning',
  'Processing',
  'Thinking deeply',
  'Working through',
  'Evaluating',
];

// Collapsible reasoning section for assistant messages with Claude extended thinking
export const ReasoningSection = ({
  reasoningContent,
  defaultExpanded = false,
  isResponseStreaming = false,
}: {
  reasoningContent: string;
  defaultExpanded?: boolean;
  isResponseStreaming?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * REASONING_PHRASES.length));
  const mountedRef = React.useRef(true);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cycle through phrases only when collapsed AND response not yet streaming
  useEffect(() => {
    mountedRef.current = true;
    
    // Stop cycling when expanded or when response starts streaming
    if (isExpanded || isResponseStreaming) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setPhraseIndex((i) => (i + 1) % REASONING_PHRASES.length);
      }
    }, 1500);
    
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isExpanded, isResponseStreaming]);

  if (!reasoningContent) return null;

  // Show "Finished thinking" when response is streaming, otherwise cycle phrases
  const displaySummary = isResponseStreaming ? 'Finished thinking' : REASONING_PHRASES[phraseIndex];

  return (
    <div className="mb-3 w-full">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted/70 border border-border/50 w-full text-left overflow-hidden"
      >
        <Lightbulb className="size-4 text-muted-foreground shrink-0" />
        
        {/* Dynamic summary with animation */}
        <motion.span 
          key={displaySummary}
          initial={{ opacity: 0.5, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="flex-1 min-w-0 text-sm text-muted-foreground truncate"
        >
          {displaySummary}
        </motion.span>
        
        <ChevronDown 
          className={cn(
            "size-4 text-muted-foreground/70 shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )} 
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, filter: 'blur(6px)' }}
            animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
            exit={{ opacity: 0, height: 0, filter: 'blur(6px)' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 text-sm text-muted-foreground/80 whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed border border-border/30">
              {reasoningContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Phrases for ThinkingMessage - keeps user engaged while waiting
const THINKING_PHRASES = [
  'Thinking',
  'Processing',
  'Analyzing',
  'Working on it',
  'Considering',
  'Preparing response',
  'Almost there',
];

// ThinkingMessage cycles through phrases while waiting for AI response
export const ThinkingMessage = ({
  searchProgress,
  chatStatus,
}: {
  searchProgress?: SearchProgress;
  chatStatus?: { status: string; message: string };
}) => {
  const role = 'assistant';
  const [dotCount, setDotCount] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * THINKING_PHRASES.length));
  const mountedRef = React.useRef(true);
  const dotIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const phraseIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Use refs for intervals to prevent issues with stale closures
  useEffect(() => {
    mountedRef.current = true;
    
    // Dot animation - every 500ms
    dotIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setDotCount((d) => (d + 1) % 4);
      }
    }, 500);

    // Phrase cycling - every 1.5 seconds
    phraseIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
      }
    }, 1500);

    return () => {
      mountedRef.current = false;
      if (dotIntervalRef.current) clearInterval(dotIntervalRef.current);
      if (phraseIntervalRef.current) clearInterval(phraseIntervalRef.current);
    };
  }, []);

  // Check if we're actively searching
  const isSearching =
    searchProgress?.status === 'searching' ||
    searchProgress?.status === 'processing';
  const searchCompleted = searchProgress?.searchesCompleted || 0;
  const searchTotal = searchProgress?.totalSearches || 0;

  // Priority: search > chat status > cycling phrase
  let displayMessage = THINKING_PHRASES[phraseIndex];

  if (searchProgress?.currentSearch) {
    displayMessage = `Searching: ${searchProgress.currentSearch}`;
  } else if (isSearching) {
    displayMessage = 'Searching the web';
  } else if (chatStatus?.message) {
    displayMessage = chatStatus.message;
  }

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={role}
      role="status"
      aria-live="polite"
      aria-label={displayMessage}
    >
      <div className="flex gap-4 w-full">
        {/* AI Icon */}
        <div className="size-8 flex items-center rounded-full justify-center shrink-0">
          <AIActiveLoaderIcon size={40} />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2">
            <motion.span 
              key={displayMessage}
              initial={{ opacity: 0.5, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="text-muted-foreground"
            >
              {displayMessage}
              {'.'.repeat(dotCount)}
            </motion.span>

            {/* Search progress */}
            {isSearching && searchTotal > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                ({searchCompleted}/{searchTotal})
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Meeting transcript component
interface MeetingTranscriptCardProps {
  speakers: number;
  summary?: string | null;
  duration?: number | null;
  createdAt?: number | null;
  meetingMetadata?: any;
  fullTranscript?: string;
}

function MeetingTranscriptCard({
  speakers,
  summary,
  duration,
  createdAt,
  meetingMetadata,
  fullTranscript,
}: MeetingTranscriptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Create a one-sentence summary from the full summary or transcript
  const createOneSentenceSummary = (text: string): string => {
    if (!text) return 'Meeting discussion recorded and ready for analysis.';

    // If we have a summary, extract the first meaningful sentence
    if (summary) {
      // Remove markdown formatting and get first sentence
      const cleanSummary = summary.replace(/[*_#`]/g, '').trim();
      const sentences = cleanSummary
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 10);
      if (sentences.length > 0) {
        const firstSentence = sentences[0].trim();
        return firstSentence.endsWith('.')
          ? firstSentence
          : `${firstSentence}.`;
      }
    }

    // Fallback to a generic summary
    return `${speakers}-speaker meeting discussion covering key topics and decisions.`;
  };

  const oneSentenceSummary = createOneSentenceSummary(
    summary || fullTranscript || '',
  );

  return (
    <Card
      className="max-w-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex-shrink-0">
            <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm">
                Meeting Transcript
              </h4>
              <Badge
                variant="secondary"
                className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
              >
                <Mic className="h-3 w-3 mr-1" />
                Recording
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-blue-700 dark:text-blue-300 mb-3">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>
                  {speakers} speaker{speakers !== 1 ? 's' : ''}
                </span>
              </div>

              {duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(duration)}</span>
                </div>
              )}

              {createdAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(createdAt)}</span>
                </div>
              )}
            </div>

            {/* One-sentence summary */}
            <div className="bg-white/50 dark:bg-blue-950/20 rounded-md p-3 border border-blue-200/50 dark:border-blue-800/50 mb-3">
              <div className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                <Markdown>{oneSentenceSummary}</Markdown>
              </div>
            </div>

            {/* Expanded transcript view */}
            {isExpanded && fullTranscript && (
              <div className="bg-white/70 dark:bg-blue-950/30 rounded-md p-3 border border-blue-200/50 dark:border-blue-800/50 mb-3 max-h-48 overflow-y-auto">
                <h5 className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Full Transcript:
                </h5>
                <div className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">
                  {fullTranscript}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                <MessageSquare className="h-3 w-3" />
                <span>Analyzing with EOS AI...</span>
              </div>

              {fullTranscript && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Click to {isExpanded ? 'hide' : 'view'} transcript
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Function to detect if a message is a meeting transcript
function isMeetingTranscript(content: string): {
  isTranscript: boolean;
  speakers?: number;
  summary?: string;
  fullTranscript?: string;
} {
  // Check if the message starts with the meeting transcript pattern
  const transcriptPattern =
    /^Please analyze this (\d+)-speaker meeting transcript:/;
  const match = content.match(transcriptPattern);

  if (match) {
    const speakers = Number.parseInt(match[1], 10);

    // Extract summary if present
    const summaryMatch = content.match(/Meeting Summary:\n(.*?)\n\n---/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : undefined;

    // Extract full transcript (everything after "Full Transcript:" or the whole content)
    const transcriptMatch = content.match(
      /Full Transcript:\n\n([\s\S]*?)(?:\n\nProvide a comprehensive analysis|$)/,
    );
    const fullTranscript = transcriptMatch
      ? transcriptMatch[1].trim()
      : content
          .replace(
            /^Please analyze this \d+-speaker meeting transcript:\n\n/,
            '',
          )
          .trim();

    return {
      isTranscript: true,
      speakers,
      summary,
      fullTranscript,
    };
  }

  return { isTranscript: false };
}

// Function to detect and parse reply context from message content
function parseReplyContext(text: string): {
  hasReply: boolean;
  replyContext?: {
    content: string;
    role: 'user' | 'assistant';
  };
  cleanedText: string;
} {
  // Look for reply header pattern: **Replying to [role]:**\n\n[quoted content]\n\n---\n\n[actual message]
  const replyPattern =
    /^\*\*Replying to (your message|assistant):\*\*\n\n((?:> .+\n?)+)\n\n---\n\n([\s\S]*)/;
  const match = text.match(replyPattern);

  if (!match) {
    return {
      hasReply: false,
      cleanedText: text,
    };
  }

  const [, roleText, quotedContent, actualMessage] = match;
  const role = roleText === 'your message' ? 'user' : 'assistant';

  // Remove the > prefix from quoted lines
  const content = quotedContent
    .split('\n')
    .map((line) => line.replace(/^> /, ''))
    .join('\n')
    .trim();

  return {
    hasReply: true,
    replyContext: {
      content,
      role,
    },
    cleanedText: actualMessage.trim(),
  };
}
