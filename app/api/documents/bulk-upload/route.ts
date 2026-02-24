import { type NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { reserveStorageAtomic, releaseStorageReservation } from '@/lib/storage/tracking';
import { processUserDocument } from '@/lib/ai/user-rag';
import { computeStringHash } from '@/lib/utils/file-hash';
import { createApiErrorResponse } from '@/lib/errors';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const MAX_FILES_PER_BATCH = 20;

interface UploadResult {
  success: boolean;
  fileName: string;
  documentId?: string;
  error?: string;
  fileSize?: number;
}

// Helper to extract text from files (simplified version)
async function extractTextFromFile(
  file: Blob,
  fileType: string,
  fileName: string,
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // PDF
    if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      return data.text;
    }

    // Excel
    if (
      fileType.includes('spreadsheet') ||
      fileName.toLowerCase().match(/\.(xlsx?|csv)$/)
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let allText = '';
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_txt(worksheet);
        allText += `\n--- Sheet: ${sheetName} ---\n${sheetText}`;
      });
      return allText;
    }

    // Word documents
    if (
      fileType.includes('wordprocessingml') ||
      fileName.toLowerCase().endsWith('.docx')
    ) {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('text');
      if (documentXml) {
        const text = documentXml
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return text;
      }
    }

    // Plain text
    if (fileType.startsWith('text/') || fileName.toLowerCase().endsWith('.txt')) {
      return buffer.toString('utf-8');
    }

    return ''; // Unsupported type
  } catch (error) {
    console.error(`Error extracting text from ${fileName}:`, error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  
  // Track storage reservation for cleanup on error
  let storageReserved = 0;
  let userId: string | undefined;

  // Handle request cancellation
  request.signal?.addEventListener('abort', () => {
    abortController.abort();
  });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return createApiErrorResponse('Unauthorized', 401, 'authentication');
    }
    userId = session.user.id;

    const formData = await request.formData();
    const files: File[] = [];
    const category = (formData.get('category') as string) || 'Other';

    // Extract all files from form data
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return createApiErrorResponse('No files provided', 400, 'validation');
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_BATCH} files allowed per batch` },
        { status: 400 },
      );
    }

    // Check total size against quota and atomically reserve storage
    // This prevents race conditions where concurrent uploads could exceed the quota
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const quotaCheck = await reserveStorageAtomic(session.user.id, totalSize);

    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Storage quota exceeded',
          details: quotaCheck.reason,
          availableSpace: quotaCheck.availableSpace,
        },
        { status: 403 },
      );
    }

    // Storage is now reserved - track for cleanup on error
    storageReserved = totalSize;

    // Process files in parallel with Promise.allSettled
    const results: UploadResult[] = await Promise.allSettled(
      files.map(async (file) => {
        try {
          // Extract text content
          const textContent = await extractTextFromFile(
            file,
            file.type,
            file.name,
          );

          if (!textContent || textContent.trim().length === 0) {
            throw new Error('Could not extract text content from file');
          }

          // Compute content hash
          const contentHash = await computeStringHash(textContent);

          // Upload to Vercel Blob
          const blob = await put(file.name, file, {
            access: 'public',
            addRandomSuffix: true,
          });

          // Insert into database
          const [newDocument] = await db
            .insert(userDocuments)
            .values({
              userId: session.user.id,
              fileName: file.name.substring(0, 250),
              fileUrl: blob.url,
              fileSize: file.size,
              fileType: file.type || 'application/octet-stream',
              category: category as any,
              content: textContent,
              contentHash,
              isContext: true,
              processingStatus: 'pending',
            })
            .returning();

          // Process for RAG (async, don't wait)
          // Check if request was aborted before starting RAG processing
          if (abortSignal.aborted) {
            // Update status to indicate cancellation (using optimistic locking)
            try {
              await db
                .update(userDocuments)
                .set({ processingStatus: 'failed', processingError: 'Request cancelled' })
                .where(
                  and(
                    eq(userDocuments.id, newDocument.id),
                    eq(userDocuments.processingStatus, 'pending'),
                  ),
                );
            } catch (updateError) {
              // Ignore update errors on cancellation
            }
            throw new Error('Request cancelled');
          }

          // Mark as processing first (using optimistic locking)
          await db
            .update(userDocuments)
            .set({ processingStatus: 'processing' })
            .where(
              and(
                eq(userDocuments.id, newDocument.id),
                eq(userDocuments.processingStatus, 'pending'),
              ),
            );

          processUserDocument(session.user.id, newDocument.id, textContent, {
            fileName: file.name,
            category,
            fileType: file.type,
          })
            .then(async () => {
              // Check if request was aborted
              if (abortSignal.aborted) {
                return;
              }
              // Update status to ready (using optimistic locking)
              try {
                await db
                  .update(userDocuments)
                  .set({ processingStatus: 'ready' })
                  .where(
                    and(
                      eq(userDocuments.id, newDocument.id),
                      eq(userDocuments.processingStatus, 'processing'),
                    ),
                  );
              } catch (updateError) {
                console.error(
                  `[Bulk Upload] Failed to update status to ready for document ${newDocument.id}:`,
                  updateError instanceof Error ? updateError.message : String(updateError),
                );
                // Log to monitoring system if available
              }
            })
            .catch(async (error) => {
              // Don't process errors if request was aborted
              if (abortSignal.aborted) {
                return;
              }

              console.error(`[Bulk Upload] RAG processing failed for ${file.name}:`, {
                documentId: newDocument.id,
                fileName: file.name,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              });
              // Update status to failed (using optimistic locking)
              try {
                await db
                  .update(userDocuments)
                  .set({
                    processingStatus: 'failed',
                    processingError:
                      error instanceof Error ? error.message : 'Unknown error',
                  })
                  .where(
                    and(
                      eq(userDocuments.id, newDocument.id),
                      eq(userDocuments.processingStatus, 'processing'),
                    ),
                  );
              } catch (updateError) {
                console.error(
                  `[Bulk Upload] Failed to update status to failed for document ${newDocument.id}:`,
                  updateError instanceof Error ? updateError.message : String(updateError),
                );
              }
            });

          return {
            success: true,
            fileName: file.name,
            documentId: newDocument.id,
            fileSize: file.size,
          };
        } catch (error) {
          return {
            success: false,
            fileName: file.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    ).then((settled) =>
      settled.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              success: false,
              fileName: 'unknown',
              error: result.reason?.message || 'Processing failed',
            },
      ),
    );

    // Calculate stats
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const totalUploaded = successful.reduce((sum, r) => sum + (r.fileSize || 0), 0);

    // Release unused storage reservation (we reserved totalSize but only used totalUploaded)
    const unusedReservation = totalSize - totalUploaded;
    if (unusedReservation > 0) {
      await releaseStorageReservation(session.user.id, unusedReservation).catch(
        (e) => console.error('Failed to release unused storage reservation:', e)
      );
    }

    return NextResponse.json({
      message: `Uploaded ${successful.length} of ${files.length} files`,
      results,
      summary: {
        total: files.length,
        successful: successful.length,
        failed: failed.length,
        totalSize: totalUploaded,
      },
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    // On error, try to release the storage reservation
    if (storageReserved > 0 && userId) {
      await releaseStorageReservation(userId, storageReserved).catch(
        (e) => console.error('Failed to release storage reservation on error:', e)
      );
    }
    return createApiErrorResponse(
      'Bulk upload failed',
      500,
      'file_operation',
    );
  }
}


