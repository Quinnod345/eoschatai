import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod/v3';

import { auth } from '@/app/(auth)/auth';
import {
  getAccessContext,
  incrementUsageCounter,
  broadcastEntitlementsUpdated,
} from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: 'File size should be less than 10MB',
    })
    // Update the file type based on the kind of files you want to accept
    .refine(
      (file) => {
        const validMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];

        // Check if the file type is in our list of valid types
        if (validMimeTypes.includes(file.type)) {
          return true;
        }

        // For files with potentially incorrect MIME types, check extension
        const filename = (file as any).name || '';
        const ext = filename.split('.').pop()?.toLowerCase();
        const validExtensions = [
          'jpg',
          'jpeg',
          'png',
          'gif',
          'webp',
          'bmp',
          'pdf',
          'doc',
          'docx',
          'xls',
          'xlsx',
        ];

        return validExtensions.includes(ext || '');
      },
      {
        message:
          'Unsupported file type. Accepted formats: JPEG, PNG, GIF, WebP, BMP, PDF, DOC, DOCX, XLS, XLSX',
      },
    ),
});

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

  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const originalFilename = (formData.get('file') as File).name;

    // Sanitize filename: remove any trailing dots, multiple dots, and unsafe characters
    const sanitizedFilename = originalFilename
      .trim()
      .replace(/\.+$/, '') // Remove trailing dots
      .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
      .replace(/[^\w\s.-]/g, '_'); // Replace unsafe characters with underscore

    // Create a unique filename with timestamp to avoid collisions
    const timestamp = Date.now();
    const lastDot = sanitizedFilename.lastIndexOf('.');
    let fileBaseName: string;
    let fileExtension: string | undefined;
    if (lastDot > 0 && lastDot < sanitizedFilename.length - 1) {
      fileBaseName = sanitizedFilename.substring(0, lastDot);
      fileExtension = sanitizedFilename.substring(lastDot + 1);
    } else {
      // No usable extension present
      fileBaseName = sanitizedFilename;
      fileExtension = undefined;
    }
    const uniqueFilename = fileExtension
      ? `${fileBaseName}-${timestamp}.${fileExtension}`
      : `${fileBaseName}-${timestamp}`;

    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await put(uniqueFilename, fileBuffer, {
        access: 'public',
        addRandomSuffix: false, // We're already adding timestamp for uniqueness
        contentType: file.type, // Explicitly set content type
      });

      console.log(
        `File uploaded successfully: ${uniqueFilename} -> ${data.url}`,
      );

      await incrementUsageCounter(session.user.id, 'uploads_total', 1);
      await broadcastEntitlementsUpdated(session.user.id);

      return NextResponse.json(data);
    } catch (error) {
      console.error('Blob upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
