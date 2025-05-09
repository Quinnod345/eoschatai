import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import React, { memo, useState, useMemo } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, AILoaderIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import { PDFPreview } from './pdf-preview';
import { DocumentBadge } from './document-badge';

// Extend UIMessage type to include provider
interface ExtendedUIMessage extends UIMessage {
  provider?: string;
}

interface PDFContent {
  name: string;
  pageCount: number;
}

interface DocumentContent {
  name: string;
  type: 'Word Document' | 'Spreadsheet';
  pageCount?: number;
}

interface ImageAnalysis {
  name: string;
  description: string;
  hasText: boolean;
}

// Regular expression to extract PDF metadata from message text
const PDF_CONTENT_REGEX =
  /===\s+PDF\s+Content\s+from\s+([^\(]+)\s+\((\d+)\s+pages\)\s+===\n\n([\s\S]*?)(?=\n\n===|\n*$)/gi;

// Regular expression to extract document content
const DOC_CONTENT_REGEX =
  /===\s+(Word Document|Spreadsheet)\s+Content\s+from\s+([^\(]+)(?:\s+\((\d+)\s+pages\))?\s+===\n\n([\s\S]*?)(?=\n\n===|\n*$)/gi;

// Regular expression to extract image analysis
const IMAGE_ANALYSIS_REGEX =
  /===\s+Image\s+Analysis\s+for\s+([^\n]+)\s+===\s*\n+Description:\s+([^\n]+)(?:\s*\n+Extracted\s+Text:\s+([^\n=]*))?([\s\S]*?)(?=\n\n===|\n*$)/gi;

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
    // Remove PDF content sections completely
    cleanedText = text.replace(
      /===\s+PDF\s+Content\s+from\s+[^\(]+\s+\(\d+\s+pages\)\s+===\n\n[\s\S]*?(?=\n\n===|\n*$)/gi,
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
    // Remove document content sections completely
    cleanedText = text.replace(
      /===\s+(Word Document|Spreadsheet)\s+Content\s+from\s+[^\(]+(?:\s+\(\d+\s+pages\))?\s+===\n\n[\s\S]*?(?=\n\n===|\n*$)/gi,
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
    // Remove image analysis sections completely
    cleanedText = text.replace(
      /===\s+Image\s+Analysis\s+for\s+[^\n]+\s+===\s*\n+Description:\s+[^\n]+(?:\s*\n+Extracted\s+Text:\s+[^\n=]*)?([\s\S]*?)(?=\n\n===|\n*$)/gi,
      '',
    );
    // Clean up any leftover whitespace
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
  }

  return { images, cleanedText };
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: ExtendedUIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Process text parts to extract PDF content
  const processedParts = useMemo(() => {
    if (!message.parts)
      return {
        parts: message.parts,
        pdfContents: [],
        documentContents: [],
        imageAnalyses: [],
      };

    const pdfContents: PDFContent[] = [];
    const documentContents: DocumentContent[] = [];
    const imageAnalyses: ImageAnalysis[] = [];

    // Process each text part to extract structured content
    const parts = message.parts.map((part) => {
      if (part.type === 'text') {
        // First extract and clean PDF contents
        const { pdfs, cleanedText: textWithoutPdfs } = extractPDFContent(
          part.text,
        );
        pdfContents.push(...pdfs);

        // Then extract and clean document contents
        const { documents, cleanedText: textWithoutDocs } =
          extractDocumentContent(textWithoutPdfs);
        documentContents.push(...documents);

        // Finally extract and clean image analyses
        const { images, cleanedText: finalCleanedText } =
          extractImageAnalysis(textWithoutDocs);
        imageAnalyses.push(...images);

        // Create a new part with the cleaned text
        return { ...part, text: finalCleanedText };
      }
      return part;
    });

    return { parts, pdfContents, documentContents, imageAnalyses };
  }, [message.parts]);

  const { parts, pdfContents, documentContents, imageAnalyses } =
    processedParts;

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
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
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <AILoaderIcon size={14} />
              </div>
            </div>
          )}

          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {/* Show PDF, document, and image previews above message content for user messages */}
            {message.role === 'user' &&
              (pdfContents.length > 0 ||
                documentContents.length > 0 ||
                imageAnalyses.length > 0) && (
                <div className="flex flex-row justify-end gap-2 flex-wrap">
                  {pdfContents.map((pdf, index) => (
                    <PDFPreview
                      key={`pdf-${index}-${pdf.name}`}
                      name={pdf.name}
                      pageCount={pdf.pageCount}
                      alignRight={true}
                    />
                  ))}

                  {documentContents.map((doc, index) => (
                    <DocumentBadge
                      key={`doc-${index}-${doc.name}`}
                      name={doc.name}
                      type={doc.type}
                      pageCount={doc.pageCount}
                      alignRight={true}
                    />
                  ))}

                  {imageAnalyses.map((img, index) => (
                    <div
                      key={`img-${index}-${img.name}`}
                      className="flex flex-row items-center gap-1.5 text-xs bg-muted py-1 px-2 rounded-md ml-auto"
                    >
                      <svg
                        className="size-4 text-purple-500"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M20.4 14.5 16 10 4 20" />
                      </svg>
                      <span className="line-clamp-1">{img.name}</span>
                      {img.hasText && (
                        <span className="text-xs px-1 bg-primary/10 text-primary rounded">
                          Text
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

            {/* Show regular attachments */}
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  data-testid={`message-attachments`}
                  className="flex flex-row justify-end gap-2"
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

            {/* Show PDF previews for assistant messages */}
            {message.role === 'assistant' &&
              (pdfContents.length > 0 ||
                documentContents.length > 0 ||
                imageAnalyses.length > 0) && (
                <div className="flex flex-row gap-2 flex-wrap">
                  {pdfContents.map((pdf, index) => (
                    <PDFPreview
                      key={`pdf-${index}-${pdf.name}`}
                      name={pdf.name}
                      pageCount={pdf.pageCount}
                    />
                  ))}

                  {documentContents.map((doc, index) => (
                    <DocumentBadge
                      key={`doc-${index}-${doc.name}`}
                      name={doc.name}
                      type={doc.type}
                      pageCount={doc.pageCount}
                    />
                  ))}

                  {imageAnalyses.map((img, index) => (
                    <div
                      key={`img-${index}-${img.name}`}
                      className="flex flex-row items-center gap-1.5 text-xs bg-muted py-1 px-2 rounded-md"
                    >
                      <svg
                        className="size-4 text-purple-500"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M20.4 14.5 16 10 4 20" />
                      </svg>
                      <span className="line-clamp-1">{img.name}</span>
                      {img.hasText && (
                        <span className="text-xs px-1 bg-primary/10 text-primary rounded">
                          Text
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

            {parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                // Split the reasoning and final answer
                const finalAnswerSeparators = [
                  '===== FINAL ANSWER =====',
                  '</think>',
                  '<\\/think>', // Sometimes the tag might be escaped
                ];

                // Debug: Log full reasoning content
                console.log('Full reasoning content:', {
                  length: part.reasoning.length,
                  start: part.reasoning.substring(0, 200),
                  end: part.reasoning.substring(part.reasoning.length - 200),
                });

                // Analyze the content to find the best split point
                // This is complex because the model might mention the separator in its thinking

                // First look for think tags to identify the thinking section
                const thinkStartTag = '<think>';
                const thinkEndTag = '</think>';
                const hasThinkStart = part.reasoning.includes(thinkStartTag);
                const hasThinkEnd = part.reasoning.includes(thinkEndTag);

                let separatorIndex = -1;
                let usedSeparator = '';
                let reasoningText = part.reasoning;
                let finalAnswer = '';

                // Case 1: We have proper think tags
                if (hasThinkStart && hasThinkEnd) {
                  // Find the last occurrence of </think>
                  const thinkEndIndex = part.reasoning.lastIndexOf(thinkEndTag);
                  if (thinkEndIndex !== -1) {
                    separatorIndex = thinkEndIndex;
                    usedSeparator = thinkEndTag;

                    // Extract reasoning and final answer
                    reasoningText = part.reasoning.substring(
                      0,
                      thinkEndIndex + thinkEndTag.length,
                    );
                    finalAnswer = part.reasoning
                      .substring(thinkEndIndex + thinkEndTag.length)
                      .trim();

                    // Further cleanup for the final answer - remove any "FINAL ANSWER" text at the beginning
                    finalAnswer = finalAnswer.replace(
                      /^\s*(?:===+\s*FINAL\s+ANSWER\s*===+)?\s*/i,
                      '',
                    );

                    console.log('Split at </think> tag:', {
                      separatorIndex,
                      reasoningLength: reasoningText.length,
                      finalAnswerLength: finalAnswer.length,
                    });
                  }
                }
                // Case 2: Look for the actual separator, but only after any think tags
                else if (!hasThinkStart) {
                  // If no think tags, then look for the separator directly
                  for (const sep of finalAnswerSeparators) {
                    // Don't look for </think> if we didn't see <think>
                    if (
                      (sep === '</think>' || sep === '<\\/think>') &&
                      !hasThinkStart
                    ) {
                      continue;
                    }

                    // Find the separator
                    const index = part.reasoning.indexOf(sep);
                    if (index !== -1) {
                      // Only use if it seems like a real separator (not mentioned in thinking)
                      // Improved heuristics to identify legitimate separators:

                      // Check if it's on its own line
                      const textBeforeSep = part.reasoning
                        .substring(0, index)
                        .trim();
                      const lastNewline = textBeforeSep.lastIndexOf('\n');
                      const isOnOwnLine =
                        lastNewline !== -1 && index - lastNewline < 5;

                      // Is there another newline right after it? (Real separators often have space after)
                      const textAfterSep = part.reasoning.substring(
                        index + sep.length,
                      );
                      const nextNewlineAfterSep = textAfterSep.indexOf('\n');
                      const hasNewlineAfter =
                        nextNewlineAfterSep !== -1 && nextNewlineAfterSep < 5;

                      // Check if we have enough reasoning before it
                      const hasEnoughReasoning = index > 200;

                      // For the "===== FINAL ANSWER =====" separator specifically
                      if (sep === '===== FINAL ANSWER =====') {
                        // Enhanced detection to avoid false positives:
                        // 1. Check nearby text for contextual clues that might indicate it's being mentioned
                        // 2. Make sure it's not part of an explanation of the format
                        const nearbyTextBefore = part.reasoning.substring(
                          Math.max(0, index - 100),
                          index,
                        );

                        // Look for signals that this is NOT a real separator
                        const negativeSignals = [
                          // It's mentioned in an explanation
                          nearbyTextBefore.includes('format'),
                          nearbyTextBefore.includes('structure'),
                          nearbyTextBefore.includes('Then'),
                          nearbyTextBefore.includes('separator'),
                          nearbyTextBefore.includes('will add'),
                          nearbyTextBefore.includes('add the'),
                          nearbyTextBefore.includes('response'),
                          nearbyTextBefore.includes('example'),
                          // It appears in a code block or quoted text
                          nearbyTextBefore.includes('```'),
                          nearbyTextBefore.includes('`'),
                          nearbyTextBefore.includes('"'),
                          // It's in a numbered list item that explains formatting
                          /\d+\s*\.\s*.*separator/.test(nearbyTextBefore),
                          // It mentions the response structure
                          nearbyTextBefore.includes('following this'),
                        ];

                        // A real separator has these characteristics
                        const isValidSeparator =
                          hasEnoughReasoning &&
                          isOnOwnLine &&
                          !negativeSignals.some((signal) => signal) &&
                          (hasNewlineAfter ||
                            index > part.reasoning.length - 100);

                        if (isValidSeparator) {
                          separatorIndex = index;
                          usedSeparator = sep;
                          break;
                        }
                      }
                      // For think tags, be less strict but still careful
                      else if (sep === '</think>' || sep === '<\\/think>') {
                        // For think tags, try to make sure we've actually seen an opening tag
                        const openingTag = '<think>';
                        const hasOpening = part.reasoning
                          .substring(0, index)
                          .includes(openingTag);

                        // Count occurrences to ensure balanced tags
                        const openingTagCount = (
                          part.reasoning
                            .substring(0, index)
                            .match(/<think>/g) || []
                        ).length;
                        const closingTagCount = (
                          part.reasoning
                            .substring(0, index)
                            .match(/<\/think>/g) || []
                        ).length;

                        // A valid think tag should:
                        // 1. Have an opening tag before it
                        // 2. Not be part of a code example
                        // 3. Have reasonable content between opening and closing
                        if (
                          hasOpening &&
                          hasEnoughReasoning &&
                          openingTagCount > closingTagCount
                        ) {
                          separatorIndex = index;
                          usedSeparator = sep;
                          break;
                        }
                      }
                      // For other separators, be less strict
                      else if (hasEnoughReasoning && isOnOwnLine) {
                        separatorIndex = index;
                        usedSeparator = sep;
                        break;
                      }
                    }
                  }

                  // If we found a valid separator
                  if (separatorIndex !== -1) {
                    reasoningText = part.reasoning.substring(0, separatorIndex);
                    finalAnswer = part.reasoning
                      .substring(separatorIndex + usedSeparator.length)
                      .trim();

                    console.log('Split at explicit separator:', {
                      usedSeparator,
                      separatorIndex,
                      reasoningLength: reasoningText.length,
                      finalAnswerLength: finalAnswer.length,
                    });
                  }
                }

                // Case 3: Look for a markdown heading after some reasoning
                if (separatorIndex === -1) {
                  // Try to find markdown headings that might indicate the start of the final answer
                  const headingPatterns = [
                    /\n##?\s+My Thoughts on/i,
                    /\n##?\s+[A-Z]/, // Any heading that starts with a capital letter
                    /\n#+\s+[A-Za-z0-9]/, // Any markdown heading
                  ];

                  for (const pattern of headingPatterns) {
                    const headingMatch = part.reasoning.match(pattern);
                    if (
                      headingMatch &&
                      headingMatch.index !== undefined &&
                      headingMatch.index > 300
                    ) {
                      // We found a heading that might be the start of the final answer
                      separatorIndex = headingMatch.index;
                      usedSeparator = headingMatch[0];

                      reasoningText = part.reasoning.substring(
                        0,
                        separatorIndex,
                      );
                      finalAnswer = part.reasoning
                        .substring(separatorIndex)
                        .trim();

                      console.log('Split at markdown heading:', {
                        usedSeparator,
                        separatorIndex,
                        reasoningLength: reasoningText.length,
                        finalAnswerLength: finalAnswer.length,
                      });

                      break;
                    }
                  }
                }

                // If we still don't have a split, look for heuristic patterns
                if (separatorIndex === -1) {
                  // Check if it looks like a complete reasoning followed by something else
                  // This is just a heuristic based on common patterns in Grok's output
                  const structureMatch = part.reasoning.match(
                    /\bFinal response structure:|\bFinal response outline:/i,
                  );
                  if (
                    structureMatch &&
                    structureMatch.index !== undefined &&
                    structureMatch.index > 300
                  ) {
                    // Look for the next paragraph break after this
                    const textAfterStructure = part.reasoning.substring(
                      structureMatch.index,
                    );
                    const nextParaBreak = textAfterStructure.match(/\n\s*\n/);

                    if (nextParaBreak && nextParaBreak.index !== undefined) {
                      separatorIndex =
                        structureMatch.index +
                        nextParaBreak.index +
                        nextParaBreak[0].length;
                      reasoningText = part.reasoning.substring(
                        0,
                        separatorIndex,
                      );
                      finalAnswer = part.reasoning
                        .substring(separatorIndex)
                        .trim();

                      console.log(
                        'Split based on structure marker and paragraph break:',
                        {
                          structureMatch: structureMatch[0],
                          separatorIndex,
                          reasoningLength: reasoningText.length,
                          finalAnswerLength: finalAnswer.length,
                        },
                      );
                    }
                  }
                }

                // If we still don't have a split and there are no thinking tags at all,
                // check if this might be just a final answer with no reasoning
                if (separatorIndex === -1 && !hasThinkStart) {
                  const looksLikeFinalAnswer =
                    !part.reasoning.includes('First, ') &&
                    !part.reasoning.includes('Step') &&
                    !part.reasoning.includes('Let me ') &&
                    !part.reasoning.includes('thinking');

                  if (looksLikeFinalAnswer) {
                    // Treat the whole thing as the final answer
                    reasoningText = '';
                    finalAnswer = part.reasoning;
                    console.log(
                      'Content appears to be just the final answer - no reasoning tags',
                    );
                  } else {
                    // If all else fails, just use the whole thing as reasoning
                    console.log(
                      'No reliable separator found - treating as pure reasoning',
                    );
                    reasoningText = part.reasoning;
                    finalAnswer = '';
                  }
                }

                // Render reasoning component and final answer separately
                return (
                  <React.Fragment key={key}>
                    {reasoningText && (
                      <MessageReasoning
                        isLoading={isLoading}
                        reasoning={reasoningText}
                        provider={(message as any).provider || 'xai'}
                      />
                    )}

                    {finalAnswer && (
                      <div
                        data-testid="message-final-answer"
                        className="flex flex-col gap-4"
                      >
                        <Markdown>{sanitizeText(finalAnswer)}</Markdown>
                      </div>
                    )}
                  </React.Fragment>
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              data-testid="message-edit-button"
                              variant="ghost"
                              className="px-2 h-fit rounded-full text-muted-foreground opacity-50 hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-4', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl shadow-lg shadow-primary/50':
                            message.role === 'user',
                        })}
                      >
                        <Markdown>{sanitizeText(part.text)}</Markdown>
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

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

                if (state === 'result') {
                  const { result } = toolInvocation;

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
                        <DocumentToolResult
                          type="update"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
              }
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message min-h-96"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <AILoaderIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Hmm...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
