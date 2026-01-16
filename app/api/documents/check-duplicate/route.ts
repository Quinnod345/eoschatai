import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createApiErrorResponse } from '@/lib/errors';

interface DuplicateCheckResponse {
  isDuplicate: boolean;
  existingDocument?: {
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: Date;
    category: string;
  };
  actions: ('replace' | 'keep_both' | 'cancel')[];
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return createApiErrorResponse('Unauthorized', 401, 'authentication');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createApiErrorResponse(
        'Invalid JSON in request body',
        400,
        'validation',
      );
    }
    const { contentHash, fileName } = body as {
      contentHash: string;
      fileName?: string;
    };

    if (!contentHash) {
      return createApiErrorResponse(
        'contentHash is required',
        400,
        'validation',
      );
    }

    // Check for duplicate based on content hash
    const [existingDoc] = await db
      .select({
        id: userDocuments.id,
        fileName: userDocuments.fileName,
        fileSize: userDocuments.fileSize,
        createdAt: userDocuments.createdAt,
        category: userDocuments.category,
      })
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.userId, session.user.id),
          eq(userDocuments.contentHash, contentHash),
        ),
      )
      .limit(1);

    const response: DuplicateCheckResponse = {
      isDuplicate: !!existingDoc,
      actions: ['replace', 'keep_both', 'cancel'],
    };

    if (existingDoc) {
      response.existingDocument = {
        id: existingDoc.id,
        fileName: existingDoc.fileName,
        fileSize: existingDoc.fileSize,
        uploadedAt: existingDoc.createdAt,
        category: existingDoc.category,
      };

      const sameFileName = fileName && existingDoc.fileName === fileName;
      response.message = sameFileName
        ? `A file with the same name "${fileName}" and identical content already exists. Uploaded on ${existingDoc.createdAt.toLocaleDateString()}.`
        : `A file with identical content already exists as "${existingDoc.fileName}". Uploaded on ${existingDoc.createdAt.toLocaleDateString()}.`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking for duplicate:', error);
    return createApiErrorResponse(
      'Failed to check for duplicates',
      500,
      'database',
    );
  }
}
