import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/app/(auth)/auth';

export async function POST(request: Request) {
  try {
    // Authenticate the user using Auth.js
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

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

    // Generate a unique filename with user ID to avoid collisions
    const fileExtension = file.name.split('.').pop();
    const fileName = `profile-pictures/${userId}-${Date.now()}.${fileExtension}`;

    // Convert file to buffer for Vercel Blob
    const fileBuffer = await file.arrayBuffer();

    // Upload to Vercel Blob
    const blob = await put(fileName, fileBuffer, {
      access: 'public',
      addRandomSuffix: false, // We're already generating a unique name with timestamp
      cacheControlMaxAge: 31536000, // Cache for 1 year (profile pictures don't change often)
    });

    console.log(`Profile picture uploaded for user: ${userId} at ${blob.url}`);

    // Return the URL of the uploaded image
    return NextResponse.json({
      success: true,
      url: blob.url,
      message: 'Profile picture uploaded successfully',
    });
  } catch (error) {
    console.error('Error handling profile picture:', error);
    return NextResponse.json(
      { error: 'Failed to process profile picture' },
      { status: 500 },
    );
  }
}
