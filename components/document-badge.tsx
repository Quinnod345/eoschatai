import { memo } from 'react';

export interface DocumentBadgeProps {
  name: string;
  type: 'Word Document' | 'Spreadsheet';
  pageCount?: number;
  alignRight?: boolean;
}

function PureDocumentBadge({
  name,
  type,
  pageCount,
  alignRight,
}: DocumentBadgeProps) {
  return (
    <div
      className={`flex flex-row items-center gap-1.5 text-xs bg-muted py-1 px-2 rounded-md ${
        alignRight ? 'ml-auto' : ''
      }`}
    >
      <svg
        className={`size-4 ${type === 'Word Document' ? 'text-blue-500' : 'text-green-500'}`}
        fill="none"
        height="24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        {type === 'Word Document' ? (
          <>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </>
        ) : (
          <>
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="7" y1="3" x2="7" y2="21" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
          </>
        )}
      </svg>
      <span className="line-clamp-1">{name}</span>
      {pageCount !== undefined && (
        <span className="text-xs px-1 bg-muted-foreground/10 text-muted-foreground rounded">
          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        </span>
      )}
    </div>
  );
}

export const DocumentBadge = memo(PureDocumentBadge);
