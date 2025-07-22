'use client';

import {
  FileText,
  FileSpreadsheet,
  FileImage,
  Eye,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

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

interface InlineUploadPreviewProps {
  pdfContents: PDFContent[];
  documentContents: DocumentContent[];
  imageAnalyses: ImageAnalysis[];
  isUserMessage?: boolean;
}

export function InlineUploadPreview({
  pdfContents,
  documentContents,
  imageAnalyses,
  isUserMessage = false,
}: InlineUploadPreviewProps) {
  const totalFiles =
    pdfContents.length + documentContents.length + imageAnalyses.length;



  if (totalFiles === 0) return null;

  return (
    <div
      className={cn('flex flex-col gap-3 w-full', isUserMessage && 'items-end')}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 text-sm',
          isUserMessage ? 'justify-end' : 'justify-start',
        )}
      >
        <Badge variant="secondary" className="gap-1.5">
          <FileDown className="h-3 w-3" />
          {totalFiles} inline upload{totalFiles > 1 ? 's' : ''}
        </Badge>
        <span className="text-muted-foreground text-xs">
          Processing document content...
        </span>
      </div>

      {/* File Cards Grid */}
      <div
        className={cn(
          'grid gap-2',
          totalFiles === 1
            ? 'grid-cols-1 max-w-sm'
            : 'grid-cols-1 sm:grid-cols-2 max-w-2xl',
          isUserMessage && 'ml-auto',
        )}
      >
        {/* PDF Files */}
        {pdfContents.map((pdf, index) => (
          <Card
            key={`pdf-${pdf.name}-${index}`}
            className="overflow-hidden hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{pdf.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF Document • {pdf.pageCount} page
                    {pdf.pageCount !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Eye className="h-3 w-3" />
                      AI is analyzing
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Document Files */}
        {documentContents.map((doc, index) => (
          <Card
            key={`doc-${doc.name}-${index}`}
            className="overflow-hidden hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'p-2.5 rounded-lg',
                    doc.type === 'Word Document'
                      ? 'bg-blue-50 dark:bg-blue-950/30'
                      : 'bg-green-50 dark:bg-green-950/30',
                  )}
                >
                  <FileSpreadsheet
                    className={cn(
                      'h-5 w-5',
                      doc.type === 'Word Document'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-green-600 dark:text-green-400',
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doc.type}{' '}
                    {doc.pageCount &&
                      `• ${doc.pageCount} page${doc.pageCount !== 1 ? 's' : ''}`}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Eye className="h-3 w-3" />
                      AI is analyzing
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Image Files */}
        {imageAnalyses.map((img, index) => (
          <Card
            key={`img-${img.name}-${index}`}
            className="overflow-hidden hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <FileImage className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{img.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {img.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Eye className="h-3 w-3" />
                      AI analyzed
                    </Badge>
                    {img.hasText && (
                      <Badge variant="secondary" className="text-xs">
                        Contains text
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
