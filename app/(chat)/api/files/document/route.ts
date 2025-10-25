import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  getAccessContext,
  incrementUsageCounter,
  broadcastEntitlementsUpdated,
} from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';

// Maximum document size (10MB)
const MAX_DOC_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Entitlement check for context uploads
  const accessContext = await getAccessContext(session.user.id);
  const uploadLimit = accessContext.entitlements.features.context_uploads_total;
  if (uploadLimit <= 0) {
    await trackBlockedAction({
      feature: 'context_uploads_total',
      reason: 'not_enabled',
      user_id: session.user.id,
      org_id: accessContext.user.orgId,
      status: 403,
    });
    return NextResponse.json(
      {
        code: 'ENTITLEMENT_BLOCK',
        feature: 'context_uploads_total',
        reason: 'not_enabled',
      },
      { status: 403 },
    );
  }
  if (
    uploadLimit > 0 &&
    accessContext.user.usageCounters.uploads_total >= uploadLimit
  ) {
    await trackBlockedAction({
      feature: 'context_uploads_total',
      reason: 'limit_exceeded',
      user_id: session.user.id,
      org_id: accessContext.user.orgId,
      status: 403,
    });
    return NextResponse.json(
      {
        code: 'ENTITLEMENT_BLOCK',
        feature: 'context_uploads_total',
        reason: 'limit_exceeded',
      },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      console.error('Document processing: No file uploaded');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Get file extension
    const filename = (file as File).name || '';
    const fileExt = filename.split('.').pop()?.toLowerCase();

    // Verify file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ];

    const validExtensions = ['docx', 'xlsx', 'pptx'];

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExt || '')
    ) {
      console.error(`Document processing: Invalid file type ${file.type}`);
      return NextResponse.json(
        {
          error:
            'File must be a Word document, Excel spreadsheet, or PowerPoint presentation',
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_DOC_SIZE) {
      console.error(`Document processing: File too large (${file.size} bytes)`);
      return NextResponse.json(
        {
          error: `Document size exceeds the maximum allowed size of ${MAX_DOC_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log(
      `Document processing: File size ${arrayBuffer.byteLength} bytes`,
    );

    let text = '';
    let pageCount = 0;
    const analysisSheets: Array<any> = [];

    // Process Excel files
    if (
      file.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      fileExt === 'xlsx' ||
      fileExt === 'xls'
    ) {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // Process each sheet
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          text += `## Sheet: ${sheetName}\n\n`;

          // Convert to array-of-arrays for analysis
          const aoa: any[] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: true,
          }) as any[];

          // Append TSV rendition to text output for model readability
          const toCellString = (v: any): string => {
            if (v === undefined || v === null) return '';
            if (v instanceof Date) return v.toISOString();
            if (typeof v === 'number')
              return Number.isFinite(v) ? String(v) : '';
            if (typeof v === 'boolean') return v ? 'true' : 'false';
            if (typeof v === 'string') return v;
            try {
              return JSON.stringify(v);
            } catch {
              return String(v);
            }
          };

          aoa.forEach((row: any) => {
            if (Array.isArray(row) && row.length > 0) {
              text += `${row.map((v) => toCellString(v)).join('\t')}\n`;
            }
          });

          text += '\n';

          // Build structured analysis (schema + stats)
          const columnCount = aoa.reduce(
            (max, r) => Math.max(max, Array.isArray(r) ? r.length : 0),
            0,
          );
          const firstRow: any[] = Array.isArray(aoa[0]) ? aoa[0] : [];
          const firstRowStringRatio =
            firstRow.length === 0
              ? 0
              : firstRow.filter(
                  (v) => typeof v === 'string' && v.trim().length > 0,
                ).length / firstRow.length;
          const likelyHasHeader = firstRowStringRatio >= 0.5; // heuristic
          const headers: string[] = Array.from({ length: columnCount }).map(
            (_, i) => {
              const h = likelyHasHeader ? String(firstRow[i] ?? '').trim() : '';
              return h && h.length > 0 ? h : `Column ${i + 1}`;
            },
          );

          const dataRows = aoa.slice(likelyHasHeader ? 1 : 0) as any[];

          // Collect per-column values
          const columns = headers.map((header, colIdx) => {
            const values = dataRows.map((r) =>
              Array.isArray(r) ? r[colIdx] : undefined,
            );
            const nonNull = values.filter(
              (v) => v !== undefined && v !== null && v !== '',
            );

            // Infer type using simple heuristic
            const numValues: number[] = [];
            const strValues: string[] = [];
            const dateValues: Date[] = [];
            nonNull.forEach((v) => {
              if (typeof v === 'number' && Number.isFinite(v)) {
                numValues.push(v);
                return;
              }
              // Excel dates may come as JS Date objects or numbers; raw:true preserves types when possible
              if (v instanceof Date) {
                dateValues.push(v);
                return;
              }
              if (typeof v === 'string') {
                // Try parse number
                const parsed = Number(v);
                if (v.trim() !== '' && Number.isFinite(parsed)) {
                  numValues.push(parsed);
                } else {
                  // Try parse date
                  const d = new Date(v);
                  if (!Number.isNaN(d.getTime())) {
                    dateValues.push(d);
                  } else {
                    strValues.push(v);
                  }
                }
                return;
              }
              // Fallback to string representation
              strValues.push(String(v));
            });

            let inferredType: 'number' | 'string' | 'date' | 'mixed' | 'empty' =
              'empty';
            if (
              numValues.length > 0 &&
              strValues.length === 0 &&
              dateValues.length === 0
            )
              inferredType = 'number';
            else if (
              dateValues.length > 0 &&
              numValues.length === 0 &&
              strValues.length === 0
            )
              inferredType = 'date';
            else if (
              strValues.length > 0 &&
              numValues.length === 0 &&
              dateValues.length === 0
            )
              inferredType = 'string';
            else if (nonNull.length === 0) inferredType = 'empty';
            else inferredType = 'mixed';

            // Compute basic stats
            const stats: Record<string, any> = {
              nonNullCount: nonNull.length,
              missingCount: values.length - nonNull.length,
              uniqueCount: new Set(nonNull.map((v) => toCellString(v))).size,
              sampleValues: nonNull
                .slice(0, 5)
                .map((v) => (v instanceof Date ? v.toISOString() : v)),
            };

            if (inferredType === 'number' && numValues.length > 0) {
              const sorted = [...numValues].sort((a, b) => a - b);
              const sum = numValues.reduce((a, b) => a + b, 0);
              const mean = sum / numValues.length;
              const mid = Math.floor(sorted.length / 2);
              const median =
                sorted.length % 2 !== 0
                  ? sorted[mid]
                  : (sorted[mid - 1] + sorted[mid]) / 2;
              Object.assign(stats, {
                min: sorted[0],
                max: sorted[sorted.length - 1],
                mean,
                median,
              });
            }

            if (inferredType === 'date' && dateValues.length > 0) {
              const timestamps = dateValues
                .map((d) => d.getTime())
                .sort((a, b) => a - b);
              Object.assign(stats, {
                min: new Date(timestamps[0]).toISOString(),
                max: new Date(timestamps[timestamps.length - 1]).toISOString(),
              });
            }

            return {
              name: header,
              type: inferredType,
              ...stats,
            };
          });

          // Create preview rows (first up to 10)
          const preview = dataRows.slice(0, 10).map((row) => {
            const obj: Record<string, any> = {};
            headers.forEach((h, i) => {
              obj[h] = Array.isArray(row) ? (row[i] ?? null) : null;
            });
            return obj;
          });

          analysisSheets.push({
            name: sheetName,
            rowCount: dataRows.length,
            columnCount,
            headers,
            columns,
            preview,
          });
        });

        // Count sheets as "pages"
        pageCount = workbook.SheetNames.length;

        console.log(
          `Excel processing: Successfully extracted ${text.length} characters from ${pageCount} sheets`,
        );
      } catch (excelError: any) {
        console.error('Excel parsing error:', excelError);
        return NextResponse.json(
          {
            error: `Failed to parse Excel file: ${excelError.message || 'Unknown error'}`,
          },
          { status: 422 },
        );
      }
    }
    // Process Word documents
    else if (
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileExt === 'docx'
    ) {
      try {
        const zip = new JSZip();
        const content = await zip.loadAsync(arrayBuffer);

        // Extract document.xml
        const documentXml = await content
          .file('word/document.xml')
          ?.async('text');

        if (documentXml) {
          // Extract text from XML tags
          const tagMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
          if (tagMatches) {
            text = tagMatches
              .map((match) => {
                // Extract content between tags
                const content = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
                return content;
              })
              .join(' ');
          }

          // Try to estimate page count (rough approximation)
          pageCount = Math.ceil(text.length / 3000); // Assuming ~3000 chars per page

          console.log(
            `Word processing: Successfully extracted ${text.length} characters, estimated ${pageCount} pages`,
          );
        } else {
          throw new Error('Could not extract document.xml from DOCX file');
        }
      } catch (docxError: any) {
        console.error('Word document parsing error:', docxError);
        return NextResponse.json(
          {
            error: `Failed to parse Word document: ${docxError.message || 'Unknown error'}`,
          },
          { status: 422 },
        );
      }
    }
    // Process PowerPoint files
    else if (
      file.type ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileExt === 'pptx'
    ) {
      try {
        const zip = new JSZip();
        const content = await zip.loadAsync(arrayBuffer);

        // Get the presentation.xml for slide structure
        const presXml = await content
          .file('ppt/presentation.xml')
          ?.async('text');

        if (!presXml) {
          throw new Error('Could not find presentation.xml in PPTX file');
        }

        // Extract slide count from presentation.xml
        const slideMatches = presXml.match(/<p:sldId[^>]*>/g);
        const slideCount = slideMatches ? slideMatches.length : 0;
        pageCount = slideCount;

        // Extract text from each slide
        const slideTexts: string[] = [];

        for (let i = 1; i <= slideCount; i++) {
          const slideXml = await content
            .file(`ppt/slides/slide${i}.xml`)
            ?.async('text');

          if (slideXml) {
            // Extract text from <a:t> tags (text runs in PowerPoint)
            const textMatches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
            if (textMatches) {
              const slideText = textMatches
                .map((match) => {
                  const content = match.replace(
                    /<a:t[^>]*>([^<]*)<\/a:t>/,
                    '$1',
                  );
                  return content;
                })
                .join(' ');

              if (slideText.trim()) {
                slideTexts.push(`## Slide ${i}\n\n${slideText}`);
              }
            }
          }
        }

        text = slideTexts.join('\n\n');

        console.log(
          `PowerPoint processing: Successfully extracted ${text.length} characters from ${pageCount} slides`,
        );
      } catch (pptxError: any) {
        console.error('PowerPoint parsing error:', pptxError);
        return NextResponse.json(
          {
            error: `Failed to parse PowerPoint file: ${pptxError.message || 'Unknown error'}`,
          },
          { status: 422 },
        );
      }
    }
    // Unsupported format - only DOCX, XLSX, and PPTX are supported
    // Note: DOC, XLS, and PPT (legacy Office formats) use binary format instead of XML
    // and would require additional libraries like 'word-extractor' or 'officegen-parser'
    else {
      return NextResponse.json(
        {
          error:
            'Unsupported document format. Please use DOCX, XLSX, or PPTX files (not legacy DOC/XLS/PPT formats).',
        },
        { status: 400 },
      );
    }

    await incrementUsageCounter(session.user.id, 'uploads_total', 1);
    await broadcastEntitlementsUpdated(session.user.id);

    return NextResponse.json({
      filename: (file as File).name || 'document',
      text: text,
      pageCount: pageCount,
      analysis: { sheets: analysisSheets },
    });
  } catch (error: any) {
    console.error('Document processing request error:', error);
    return NextResponse.json(
      {
        error: `Server error processing document: ${error.message || 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
}
