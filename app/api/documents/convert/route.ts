import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import {
  convertUserDocumentToComposer,
  getConversionSuggestions,
  detectOptimalComposerKind,
} from '@/lib/composer/conversion-service';
import type { ComposerKind } from '@/lib/mentions/types';

/**
 * POST /api/documents/convert
 * Convert a UserDocument to a Composer document
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      userDocumentId,
      targetKind,
      aiEnhance = true,
      preserveFormatting = false,
      generateSummary = true,
      autoDetectKind = false,
      tags = [],
      category,
    } = body;

    if (!userDocumentId) {
      return NextResponse.json(
        { error: 'userDocumentId is required' },
        { status: 400 },
      );
    }

    // If targetKind is provided but not valid
    const validKinds: ComposerKind[] = [
      'text',
      'code',
      'sheet',
      'chart',
      'vto',
      'accountability',
    ];
    if (targetKind && !validKinds.includes(targetKind)) {
      return NextResponse.json(
        { error: `Invalid targetKind. Must be one of: ${validKinds.join(', ')}` },
        { status: 400 },
      );
    }

    const result = await convertUserDocumentToComposer(
      userDocumentId,
      session.user.id,
      {
        aiEnhance,
        preserveFormatting,
        generateSummary,
        autoDetectKind: autoDetectKind || !targetKind,
        tags,
        category,
      },
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Conversion failed' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      composerId: result.composerId,
      kind: result.kind,
      title: result.title,
      contentSummary: result.contentSummary,
      suggestedTags: result.suggestedTags,
      conversionNotes: result.conversionNotes,
    });
  } catch (error) {
    console.error('Document conversion error:', error);
    return NextResponse.json(
      { error: 'Internal server error during conversion' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/documents/convert?userDocumentId=xxx
 * Get conversion suggestions for a document
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userDocumentId = searchParams.get('userDocumentId');

    if (!userDocumentId) {
      return NextResponse.json(
        { error: 'userDocumentId query parameter is required' },
        { status: 400 },
      );
    }

    const suggestions = await getConversionSuggestions(
      userDocumentId,
      session.user.id,
    );

    return NextResponse.json({
      success: true,
      ...suggestions,
    });
  } catch (error) {
    console.error('Conversion suggestions error:', error);
    
    if (error instanceof Error && error.message === 'Document not found') {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
