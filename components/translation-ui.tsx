'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { EmbeddedContent } from '@/types/upload-content';
import { Card, CardContent } from '@/components/ui/card';

// Minimal, unified UI translation component
// - Renders text notices (calendar, errors, successes)
// - Renders uploads with a single visual style, driven by EmbeddedContent JSON

interface TranslationUIProps {
  contents: EmbeddedContent[];
  align: 'start' | 'end';
}

export function TranslationUI({ contents, align }: TranslationUIProps) {
  if (!contents || contents.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        align === 'end' ? 'items-end' : 'items-start',
      )}
    >
      {contents.map((content, idx) => {
        const key = `${content.type}-${content.name}-${idx}`;

        if (content.type === 'notice' || content.type === 'calendar') {
          // Textual notice: calendar, error, success, info
          const {
            Alert,
            AlertDescription,
            AlertTitle,
          } = require('@/components/ui/alert');
          const {
            AlertCircle,
            CheckCircle,
            Info,
            Calendar,
          } = require('lucide-react');
          const severity =
            content.metadata.severity ||
            (content.type === 'calendar' && content.metadata.status === 'error'
              ? 'error'
              : 'info');
          const title =
            content.metadata.title ||
            content.name ||
            (content.type === 'calendar' ? 'Calendar' : 'Notice');
          const messageText = content.metadata.message || content.content || '';
          const variant = severity === 'error' ? 'destructive' : 'default';
          const Icon =
            content.type === 'calendar'
              ? Calendar
              : severity === 'error'
                ? AlertCircle
                : severity === 'success'
                  ? CheckCircle
                  : Info;

          return (
            <Alert key={key} variant={variant as any}>
              <Icon className="h-4 w-4" />
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{messageText}</AlertDescription>
            </Alert>
          );
        }

        // Unified uploads card for pdf, document, image, audio, video, file
        const {
          FileText,
          FileSpreadsheet,
          FileImage,
          FileAudio2,
          FileVideo,
          File,
        } = require('lucide-react');
        const typeIcon =
          content.type === 'pdf'
            ? FileText
            : content.type === 'document'
              ? FileSpreadsheet
              : content.type === 'image'
                ? FileImage
                : content.type === 'audio'
                  ? FileAudio2
                  : content.type === 'video'
                    ? FileVideo
                    : File;

        const meta = content.metadata || {};
        const subtitle: string[] = [];
        if (content.type === 'pdf' && meta.pageCount)
          subtitle.push(
            `${meta.pageCount} page${meta.pageCount === 1 ? '' : 's'}`,
          );
        if (content.type === 'document')
          subtitle.push(String(meta.docType || 'Document'));
        if (content.type === 'image' && meta.dimensions)
          subtitle.push(`${meta.dimensions.width}×${meta.dimensions.height}`);
        if (
          (content.type === 'audio' || content.type === 'video') &&
          meta.duration
        )
          subtitle.push(
            `${Math.floor(meta.duration / 60)}:${String(Math.floor(meta.duration % 60)).padStart(2, '0')}`,
          );
        if (meta.mimeType) subtitle.push(meta.mimeType);

        return (
          <Card key={key} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-muted">
                  {React.createElement(typeIcon, {
                    className: 'h-5 w-5 text-foreground/80',
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {content.name}
                  </h4>
                  {(subtitle.length > 0 || meta.description) && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {[...subtitle, meta.description]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}

                  {/* Audio transcript snippet show if provided (collapsed) */}
                  {content.type === 'audio' &&
                    (meta.transcript || content.content) && (
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {meta.transcript || content.content}
                      </div>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}



