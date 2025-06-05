import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartRenderer } from './chart-renderer';
import { CitationRenderer } from './inline-citation';
import type { ChartData } from '@/artifacts/chart/client';

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

// Function to detect and parse chart data from content
function detectChartData(content: string): ChartData | null {
  try {
    // Remove common markdown formatting
    const cleanContent = content
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
        <div className="my-4 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
            Interactive Chart
          </div>
          <div className="p-4">
            <ChartRenderer chartData={chartData} />
          </div>
        </div>
      );
    }

    // Fallback to regular code block
    return (
      <pre
        {...props}
        className="text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900"
      >
        <code className="whitespace-pre-wrap break-words">{children}</code>
      </pre>
    );
  } else {
    return (
      <code
        className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
        {...props}
      >
        {children}
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
          return cells.map((cell) => cell.textContent?.trim() || '').join('\t');
        })
        .join('\n');

      navigator.clipboard.writeText(tableText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative w-full h-full max-w-7xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 ease-out opacity-0 scale-95"
            onClick={(e) => e.stopPropagation()}
            style={{
              opacity: 1,
              transform: 'scale(1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Full Table View
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyTableToClipboard}
                  className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200"
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
                      className="w-4 h-4 text-zinc-600 dark:text-zinc-400"
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
                  className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200"
                  title="Close"
                >
                  <svg
                    className="w-4 h-4 text-zinc-600 dark:text-zinc-400"
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
    </>
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
            className: `${(child.props as any).className || ''} ${
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

  const isNumeric = /^[\d,.-]+$/.test(content?.toString().trim() || '');
  const isStatus = /^(pending|complete|active|inactive)$/i.test(
    content?.toString().trim() || '',
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
      return <>{children}</>;
    }

    // Otherwise render as normal paragraph
    return <p>{children}</p>;
  },
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
  // Create enhanced components that support citations
  const enhancedComponents: Partial<Components> = {
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
        return <>{children}</>;
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

      // Check if we have citations and the text contains citation patterns
      if (citations.length > 0 && /\[\d+\]/.test(textContent)) {
        return (
          <p>
            <CitationRenderer text={textContent} citations={citations} />
          </p>
        );
      }

      // Otherwise render as normal paragraph
      return <p>{children}</p>;
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={enhancedComponents}
    >
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    JSON.stringify(prevProps.citations) === JSON.stringify(nextProps.citations),
);
