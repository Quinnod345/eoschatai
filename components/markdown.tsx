import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartRenderer } from './chart-renderer';
import { CitationButton } from './citation-button';
import type { ChartData } from '@/composer/chart/client';
import { motion } from 'framer-motion';
import { ErrorBoundary } from './error-boundary';

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

// Cursor component for streaming text
const Cursor = () => (
  <span className="inline-block w-[3px] h-[1.1em] bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse align-text-bottom ml-0.5 rounded-full opacity-90" />
);

// Helper to replace cursor token with Cursor component in a string
const renderStringWithCursor = (text: string) => {
  if (!text.includes('$$CURSOR$$')) return text;
  const parts = text.split('$$CURSOR$$');
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <Cursor />}
        </React.Fragment>
      ))}
    </>
  );
};

// Helper to process React children and replace cursor token in text nodes
const replaceCursorInChildren = (
  children: React.ReactNode,
): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return renderStringWithCursor(child);
    }
    // We generally don't need to recurse deep because the cursor is appended
    // to the raw markdown string, so it usually appears as a direct text node
    // or at the end of the last text node.
    // However, ReactMarkdown might nest it (e.g. inside <strong>).
    // A shallow recursive check for simple elements might be good if needed,
    // but for now top-level check + string check covers 99% of streaming cases.

    // If it's a React element with children, we could potentially clone and recurse,
    // but ReactMarkdown elements are often specific components.
    // Let's rely on the fact that text nodes are passed as children to parents.
    return child;
  });
};

// Mask URLs inside citation markup to prevent autolinking before we replace them
function maskUrlsInCitations(text: string): string {
  if (!text || typeof text !== 'string') return text;
  // Matches citation patterns like CITE:number:url or number:url with optional title
  return text.replace(/\[(?:CITE:)?\d+:[^\]]+\]/g, (match) => {
    // Replace occurrences of http:// or https:// inside the match with http§// or https§//
    return match.replace(/https?:\/\//g, (m) => m.replace(':', '§'));
  });
}

// Function to detect and parse chart data from content
function detectChartData(content: string): ChartData | null {
  try {
    // Remove common markdown formatting and cursor token
    const cleanContent = content
      .replace(/\$\$CURSOR\$\$/g, '')
      .trim()
      .replace(/^```[a-zA-Z]*\n?/, '') // Remove opening code fence
      .replace(/\n?```$/, '') // Remove closing code fence
      .trim();

    // Try to parse as JSON
    const parsed = JSON.parse(cleanContent);

    // Check if it's valid chart data
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.type &&
      parsed.data &&
      parsed.data.labels &&
      parsed.data.datasets &&
      Array.isArray(parsed.data.labels) &&
      Array.isArray(parsed.data.datasets)
    ) {
      // Validate chart type
      const validTypes = [
        'line',
        'bar',
        'pie',
        'doughnut',
        'radar',
        'polarArea',
        'scatter',
        'bubble',
      ];
      if (validTypes.includes(parsed.type)) {
        return parsed as ChartData;
      }
    }
  } catch (error) {
    // Not valid JSON or chart data
  }

  return null;
}

// Enhanced code block component that can render charts
function EnhancedCodeBlock({
  node,
  inline,
  className,
  children,
  ...props
}: any) {
  if (!inline) {
    // Get the text content
    const content =
      typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.join('')
          : String(children);

    // Check if this could be chart data
    const chartData = detectChartData(content);

    if (chartData) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="my-4 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden"
        >
          <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
            Interactive Chart
          </div>
          <div className="p-4">
            <ChartRenderer chartData={chartData} />
          </div>
        </motion.div>
      );
    }

    // Fallback to regular code block
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <pre
          {...props}
          className="text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900"
        >
          <code className="whitespace-pre-wrap break-words">
            {renderStringWithCursor(content)}
          </code>
        </pre>
      </motion.div>
    );
  } else {
    // Inline code
    const content =
      typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.join('')
          : String(children);

    return (
      <code
        className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
        {...props}
      >
        {renderStringWithCursor(content)}
      </code>
    );
  }
}

// Enhanced table components with fade-off and lightbox functionality
function EnhancedTable({ children, ...props }: any) {
  const [copied, setCopied] = React.useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Check if table is overflowing
  React.useEffect(() => {
    const checkOverflow = () => {
      if (tableRef.current && containerRef.current) {
        const tableWidth = tableRef.current.scrollWidth;
        const containerWidth = containerRef.current.clientWidth;
        setIsOverflowing(tableWidth > containerWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children]);

  const copyTableToClipboard = () => {
    if (tableRef.current) {
      const rows = Array.from(tableRef.current.querySelectorAll('tr'));
      const tableText = rows
        .map((row) => {
          const cells = Array.from(row.querySelectorAll('th, td'));
          return cells.map((cell) => cell.textContent?.trim() ?? '').join('\t');
        })
        .join('\n');

      navigator.clipboard.writeText(tableText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="my-6 overflow-hidden">
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {/* Copy button */}
          <button
            type="button"
            onClick={copyTableToClipboard}
            className="absolute top-3 right-3 z-20 p-2 rounded-md bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors duration-200 group"
            title="Copy table to clipboard"
          >
            {copied ? (
              <svg
                className="w-4 h-4 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>

          <div
            ref={containerRef}
            className="relative overflow-x-auto max-w-full"
            style={{ maxWidth: '100%' }}
          >
            <table
              ref={tableRef}
              className="w-full border-collapse min-w-full"
              {...props}
            >
              {children}
            </table>

            {/* Fade overlay and expand button for overflowing tables */}
            {isOverflowing && (
              <div className="absolute top-0 right-0 h-full w-20 bg-gradient-to-l from-white dark:from-zinc-900 via-white/90 dark:via-zinc-900/90 via-white/60 dark:via-zinc-900/60 to-transparent pointer-events-none">
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors duration-200 flex items-center gap-1 whitespace-nowrap"
                    title="View full table"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                    View All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-modal-overlay flex items-center justify-center p-4 bg-black/20 backdrop-blur-[8px]"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative w-full h-full max-w-7xl max-h-[90vh] bg-background/90 backdrop-blur-[12px] border border-white/25 dark:border-zinc-700/40 rounded-2xl shadow-2xl overflow-hidden z-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
              <h3 className="text-lg font-semibold text-foreground">
                Full Table View
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyTableToClipboard}
                  className="p-2 rounded-md bg-muted hover:bg-accent transition-colors duration-200"
                  title="Copy table to clipboard"
                >
                  {copied ? (
                    <svg
                      className="w-4 h-4 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-2 rounded-md bg-muted hover:bg-accent transition-colors duration-200"
                  title="Close"
                >
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Table content */}
            <div className="overflow-auto h-full p-4">
              <table className="w-full border-collapse">{children}</table>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function EnhancedTableHead({ children, ...props }: any) {
  return (
    <thead
      className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700"
      {...props}
    >
      {children}
    </thead>
  );
}

function EnhancedTableBody({ children, ...props }: any) {
  return (
    <tbody {...props}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child) && child.type === EnhancedTableRow) {
          return React.cloneElement(child as React.ReactElement<any>, {
            className: `${(child.props as any).className ?? ''} ${
              index % 2 === 0
                ? 'bg-white dark:bg-zinc-900'
                : 'bg-zinc-50/50 dark:bg-zinc-800/50'
            } border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-200`,
          });
        }
        return child;
      })}
    </tbody>
  );
}

function EnhancedTableRow({ children, ...props }: any) {
  return <tr {...props}>{children}</tr>;
}

function EnhancedTableHeader({ children, ...props }: any) {
  return (
    <th
      className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 first:rounded-tl-xl last:rounded-tr-xl"
      {...props}
    >
      {children}
    </th>
  );
}

function EnhancedTableCell({ children, ...props }: any) {
  // Detect content type for better styling
  const content =
    typeof children === 'string'
      ? children
      : React.Children.toArray(children).join('');

  const isNumeric = /^[\d,.-]+$/.test(content?.toString().trim() ?? '');
  const isStatus = /^(pending|complete|active|inactive)$/i.test(
    content?.toString().trim() ?? '',
  );

  return (
    <td
      className={`
        px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300
        ${isNumeric ? 'text-right font-mono' : ''}
        ${isStatus ? 'text-center' : ''}
      `}
      {...props}
    >
      {isStatus ? (
        <span
          className={`
          inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
          ${content.toLowerCase() === 'complete' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}
          ${content.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
          ${content.toLowerCase() === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : ''}
          ${content.toLowerCase() === 'inactive' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' : ''}
        `}
        >
          {children}
        </span>
      ) : (
        children
      )}
    </td>
  );
}

const components: Partial<Components> = {
  code: EnhancedCodeBlock,
  pre: ({ children, ...props }) => {
    // Render pre without wrapping in paragraphs
    return <pre {...props}>{children}</pre>;
  },
  table: EnhancedTable,
  thead: EnhancedTableHead,
  tbody: EnhancedTableBody,
  tr: EnhancedTableRow,
  th: EnhancedTableHeader,
  td: EnhancedTableCell,
  // Default paragraph renderer to start - will be overridden in the memoized component
  p: ({ children }) => <p>{children}</p>,
  ol: ({ children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
};

const remarkPlugins = [remarkGfm];

interface MarkdownProps {
  children: string;
  citations?: CitationReference[];
}

const NonMemoizedMarkdown = ({ children, citations = [] }: MarkdownProps) => {
  // Pre-process to avoid autolinking inside citation markup
  const maskedChildren = maskUrlsInCitations(children);

  // Debug logging
  if (citations.length > 0) {
    console.log(
      '[Markdown] Received citations:',
      citations.length,
      'citations',
    );
  }

  // Log if we detect masked URLs in the content
  if (maskedChildren.includes('§')) {
    console.log(
      '[Markdown] ⚠️ Detected masked URLs in content - checking for citations',
    );
    const citationMatches = maskedChildren.match(/\[(?:CITE:)?\d+:[^\]]+\]/g);
    console.log('[Markdown] Citation patterns found:', citationMatches);
  }

  // Create enhanced components that support citations
  const enhancedComponents: Partial<Components> = React.useMemo(
    () => ({
      ...components,
      p: ({ children }) => {
        // Check if children contains a pre, div, or other block element
        const hasBlockChild = React.Children.toArray(children).some(
          (child) =>
            React.isValidElement(child) &&
            (child.type === 'pre' ||
              child.type === 'div' ||
              child.type === 'ol' ||
              child.type === 'ul' ||
              (typeof child.type === 'function' &&
                child.type.name === 'CodeBlock')),
        );

        // If it has any block children, render without wrapping in a paragraph
        if (hasBlockChild) {
          return <>{replaceCursorInChildren(children)}</>;
        }

        // Convert children to string more robustly
        const childrenArray = React.Children.toArray(children);
        const textContent = childrenArray
          .map((child) => {
            if (typeof child === 'string') {
              return child;
            } else if (React.isValidElement(child) && child.props.children) {
              // Recursively extract text from nested elements
              return React.Children.toArray(child.props.children)
                .map((nestedChild) =>
                  typeof nestedChild === 'string' ? nestedChild : '',
                )
                .join('');
            }
            return '';
          })
          .join('');

        // Check for inline citation format
        const inlineCitationPattern =
          /\[(?:CITE:)?(\d+):([^\]]+?)(?::([^\]]+))?\]/g;
        const hasInlineCitations = inlineCitationPattern.test(textContent);
        inlineCitationPattern.lastIndex = 0; // Reset regex

        if (hasInlineCitations) {
          // Parse and render inline citations
          const parts: (string | React.ReactElement)[] = [];
          let lastIndex = 0;
          let keyIndex = 0;

          let match = inlineCitationPattern.exec(textContent);
          while (match !== null) {
            // Add text before citation
            if (match.index > lastIndex) {
              const textPart = textContent.substring(lastIndex, match.index);
              parts.push(renderStringWithCursor(textPart));
            }

            const number = Number.parseInt(match[1], 10);
            const url = match[2]?.replace(/§/g, ':');
            let title = match[3]?.replace(/§/g, ':');

            if (!title) {
              try {
                const formattedUrl = url.startsWith('http')
                  ? url
                  : `https://${url}`;
                title = new URL(formattedUrl).hostname;
              } catch (e) {
                title = `Source ${number}`;
              }
            }

            parts.push(
              <CitationButton
                key={`inline-cite-${keyIndex++}`}
                number={number}
                title={title}
                url={url}
                inline={true}
              />,
            );

            lastIndex = match.index + match[0].length;
            match = inlineCitationPattern.exec(textContent);
          }

          // Add remaining text
          if (lastIndex < textContent.length) {
            parts.push(
              renderStringWithCursor(textContent.substring(lastIndex)),
            );
          }

          return (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {parts}
            </motion.p>
          );
        }

        // Otherwise render as normal paragraph with cursor replacement
        return (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {replaceCursorInChildren(children)}
          </motion.p>
        );
      },
      li: ({ children }) => {
        return (
          <motion.li
            className="py-1"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {replaceCursorInChildren(children)}
          </motion.li>
        );
      },
      h1: ({ children, ...props }) => (
        <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
          {replaceCursorInChildren(children)}
        </h1>
      ),
      h2: ({ children, ...props }) => (
        <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
          {replaceCursorInChildren(children)}
        </h2>
      ),
      h3: ({ children, ...props }) => (
        <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
          {replaceCursorInChildren(children)}
        </h3>
      ),
      h4: ({ children, ...props }) => (
        <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
          {replaceCursorInChildren(children)}
        </h4>
      ),
      h5: ({ children, ...props }) => (
        <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
          {replaceCursorInChildren(children)}
        </h5>
      ),
      h6: ({ children, ...props }) => (
        <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
          {replaceCursorInChildren(children)}
        </h6>
      ),
    }),
    [],
  );

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={enhancedComponents}
    >
      {maskedChildren}
    </ReactMarkdown>
  );
};

const MemoizedMarkdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    JSON.stringify(prevProps.citations) === JSON.stringify(nextProps.citations),
);

/**
 * Markdown component wrapped with error boundary to gracefully handle
 * malformed markdown or rendering errors
 */
export const Markdown = memo(function MarkdownWithErrorBoundary(
  props: Parameters<typeof NonMemoizedMarkdown>[0]
) {
  return (
    <ErrorBoundary
      context="Content"
      variant="inline"
      showRetry={true}
      fallback={(error, reset) => (
        <div className="p-3 rounded-lg bg-muted/50 border border-muted">
          <p className="text-sm text-muted-foreground">
            Failed to render content.{' '}
            <button onClick={reset} className="text-primary underline">
              Try again
            </button>
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-2 text-xs text-destructive overflow-auto">
              {error.message}
            </pre>
          )}
        </div>
      )}
    >
      <MemoizedMarkdown {...props} />
    </ErrorBoundary>
  );
});
