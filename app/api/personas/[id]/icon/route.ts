import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { persona } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate the user using Auth.js
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: personaId } = await params;

    // Verify the persona belongs to the user
    const [existingPersona] = await db
      .select()
      .from(persona)
      .where(and(eq(persona.id, personaId), eq(persona.userId, userId)));

    if (!existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
        },
        { status: 400 },
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 },
      );
    }

    // Generate a unique filename with persona ID to avoid collisions
    const fileExtension = file.name.split('.').pop();
    const fileName = `persona-icons/${personaId}-${Date.now()}.${fileExtension}`;

    // Convert file to buffer for Vercel Blob
    const fileBuffer = await file.arrayBuffer();

    // Upload to Vercel Blob
    const blob = await put(fileName, fileBuffer, {
      access: 'public',
      addRandomSuffix: false, // We're already generating a unique name with timestamp
      cacheControlMaxAge: 31536000, // Cache for 1 year (persona icons don't change often)
    });

    // Update the persona with the new icon URL
    const [updatedPersona] = await db
      .update(persona)
      .set({
        iconUrl: blob.url,
        updatedAt: new Date(),
      })
      .where(eq(persona.id, personaId))
      .returning();

    console.log(
      `Persona icon uploaded for persona: ${personaId} at ${blob.url}`,
    );

    // Return the URL of the uploaded image
    return NextResponse.json({
      success: true,
      url: blob.url,
      message: 'Persona icon uploaded successfully',
    });
  } catch (error) {
    console.error('Error handling persona icon:', error);
    return NextResponse.json(
      { error: 'Failed to process persona icon' },
      { status: 500 },
    );
  }
}
