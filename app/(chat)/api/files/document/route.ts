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
    ];

    const validExtensions = ['doc', 'docx', 'xls', 'xlsx'];

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExt || '')
    ) {
      console.error(`Document processing: Invalid file type ${file.type}`);
      return NextResponse.json(
        { error: 'File must be a Word document or Excel spreadsheet' },
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

          // Convert to JSON for easier handling
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Format as plain text table
          jsonData.forEach((row: any) => {
            if (Array.isArray(row) && row.length > 0) {
              text += `${row.join('\t')}\n`;
            }
          });

          text += '\n';
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
    // TODO: Handle DOC files if needed (non-XML format is more complex)
    else {
      return NextResponse.json(
        {
          error: 'Unsupported document format. Please use DOCX or XLSX files.',
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
