import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { orgDocument } from '@/lib/db/schema';
import { validateUuidField } from '@/lib/api/validation';
import { checkOrgPermission } from '@/lib/organizations/permissions';
import { computeStringHash } from '@/lib/utils/file-hash';
import { and, desc, eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

async function extractTextForOrgDocument(
  file: Blob,
  fileType: string,
  fileName: string,
): Promise<string> {
  if (fileType.includes('text/') || fileType.includes('markdown')) {
    return file.text();
  }

  const fileExt = fileName.split('.').pop()?.toLowerCase();
  if (fileType === 'application/pdf' || fileExt === 'pdf') {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await pdfParse(Buffer.from(buffer));
      const text = parsed.text?.trim();
      if (text) {
        return text;
      }
    } catch (error) {
      console.error('Org knowledge: PDF extraction failed:', error);
    }
    return `Unable to extract text from PDF "${fileName}".`;
  }

  try {
    return await file.text();
  } catch {
    return `Uploaded file "${fileName}" (${fileType || 'unknown type'}).`;
  }
}

// GET /api/organizations/[orgId]/knowledge
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }

    const hasPermission = await checkOrgPermission(
      session.user.id,
      validatedOrgId.value,
      'org.view',
    );
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await db
      .select({
        id: orgDocument.id,
        orgId: orgDocument.orgId,
        uploadedBy: orgDocument.uploadedBy,
        fileName: orgDocument.fileName,
        fileUrl: orgDocument.fileUrl,
        fileSize: orgDocument.fileSize,
        fileType: orgDocument.fileType,
        processingStatus: orgDocument.processingStatus,
        processingError: orgDocument.processingError,
        createdAt: orgDocument.createdAt,
        updatedAt: orgDocument.updatedAt,
      })
      .from(orgDocument)
      .where(
        and(
          eq(orgDocument.orgId, validatedOrgId.value),
          eq(orgDocument.isActive, true),
        ),
      )
      .orderBy(desc(orgDocument.createdAt));

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching org knowledge documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization knowledge documents' },
      { status: 500 },
    );
  }
}

// POST /api/organizations/[orgId]/knowledge
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }

    const hasPermission = await checkOrgPermission(
      session.user.id,
      validatedOrgId.value,
      'resources.create',
    );
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (request.body === null) {
      return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const categoryInput = formData.get('category');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large. Max allowed size is 20MB.' },
        { status: 413 },
      );
    }

    const fileName = file.name?.trim() || `org-document-${Date.now()}`;
    const fileType = file.type?.trim() || 'application/octet-stream';
    const category =
      typeof categoryInput === 'string' && categoryInput.trim().length > 0
        ? categoryInput.trim()
        : 'Org Document';

    const content = await extractTextForOrgDocument(file, fileType, fileName);
    const contentHash = await computeStringHash(content);

    const [duplicate] = await db
      .select({
        id: orgDocument.id,
        fileName: orgDocument.fileName,
        processingStatus: orgDocument.processingStatus,
      })
      .from(orgDocument)
      .where(
        and(
          eq(orgDocument.orgId, validatedOrgId.value),
          eq(orgDocument.contentHash, contentHash),
          eq(orgDocument.isActive, true),
        ),
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        {
          message: 'A matching organization document already exists',
          duplicate: true,
          document: duplicate,
        },
        { status: 200 },
      );
    }

    const blobResult = await put(
      `org-documents/${validatedOrgId.value}/${Date.now()}-${fileName}`,
      file,
      { access: 'public' },
    );

    const [newDocument] = await db
      .insert(orgDocument)
      .values({
        orgId: validatedOrgId.value,
        uploadedBy: session.user.id,
        fileName: fileName.substring(0, 255),
        fileUrl: blobResult.url,
        fileSize: file.size,
        fileType: fileType.substring(0, 255),
        content,
        contentHash,
        processingStatus: 'pending',
        processingError: null,
        isActive: true,
      })
      .returning({
        id: orgDocument.id,
        fileName: orgDocument.fileName,
        fileUrl: orgDocument.fileUrl,
        fileSize: orgDocument.fileSize,
        fileType: orgDocument.fileType,
        processingStatus: orgDocument.processingStatus,
        createdAt: orgDocument.createdAt,
      });

    void (async () => {
      try {
        await db
          .update(orgDocument)
          .set({
            processingStatus: 'processing',
            processingError: null,
            updatedAt: new Date(),
          })
          .where(eq(orgDocument.id, newDocument.id));

        const { processOrgDocument } = await import('@/lib/ai/org-rag');
        await processOrgDocument(validatedOrgId.value, newDocument.id, content, {
          fileName,
          category,
          fileType,
        });

        await db
          .update(orgDocument)
          .set({
            processingStatus: 'ready',
            processingError: null,
            updatedAt: new Date(),
          })
          .where(eq(orgDocument.id, newDocument.id));
      } catch (processingError) {
        await db
          .update(orgDocument)
          .set({
            processingStatus: 'failed',
            processingError:
              processingError instanceof Error
                ? processingError.message
                : 'Unknown processing error',
            updatedAt: new Date(),
          })
          .where(eq(orgDocument.id, newDocument.id));
      }
    })();

    return NextResponse.json({
      message: 'Organization knowledge document uploaded successfully',
      document: newDocument,
    });
  } catch (error) {
    console.error('Error uploading org knowledge document:', error);
    return NextResponse.json(
      { error: 'Failed to upload organization knowledge document' },
      { status: 500 },
    );
  }
}

// DELETE /api/organizations/[orgId]/knowledge?documentId=<uuid>
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }

    const hasPermission = await checkOrgPermission(
      session.user.id,
      validatedOrgId.value,
      'resources.delete',
    );
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get('documentId');
    const validatedDocumentId = validateUuidField(documentId, 'documentId');
    if (!validatedDocumentId.ok) {
      return NextResponse.json({ error: validatedDocumentId.error }, { status: 400 });
    }

    const [existingDoc] = await db
      .select({
        id: orgDocument.id,
        fileUrl: orgDocument.fileUrl,
      })
      .from(orgDocument)
      .where(
        and(
          eq(orgDocument.id, validatedDocumentId.value),
          eq(orgDocument.orgId, validatedOrgId.value),
          eq(orgDocument.isActive, true),
        ),
      )
      .limit(1);

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await db
      .update(orgDocument)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(orgDocument.id, existingDoc.id));

    try {
      const { deleteOrgDocument } = await import('@/lib/ai/org-rag');
      await deleteOrgDocument(validatedOrgId.value, existingDoc.id);
    } catch (vectorError) {
      console.error('Error deleting org document vectors:', vectorError);
    }

    try {
      await del(existingDoc.fileUrl);
    } catch (blobError) {
      console.error('Error deleting org document blob:', blobError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting org knowledge document:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization knowledge document' },
      { status: 500 },
    );
  }
}
