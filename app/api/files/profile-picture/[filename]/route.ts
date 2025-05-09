import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// This is a fallback API route for serving profile pictures
// if not using S3 or another cloud storage service

// Define where profile pictures are stored locally
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'profile-pictures');

export async function GET(
  request: Request,
) {
  try {
    // Extract filename from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];

    // Validate filename to prevent directory traversal attacks
    if (!filename.match(/^[a-zA-Z0-9-_]+\.(jpg|jpeg|png|gif|webp)$/)) {
      return NextResponse.json(
        { error: 'Invalid filename format' },
        { status: 400 },
      );
    }

    // In a real implementation, you would:
    // 1. Ensure the uploads directory exists
    // 2. Read the file from the filesystem
    // 3. Return it with appropriate headers

    // For demo purposes, return a placeholder image
    // In a real app, you would replace this with actual file reading
    console.log(`Would serve file: ${filename} from ${UPLOADS_DIR}`);

    // Since we don't have actual file storage implemented,
    // return a redirect to a placeholder
    return NextResponse.redirect('https://via.placeholder.com/150');

    // Actual implementation would be like:
    /*
    // Ensure directory exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    
    const filePath = path.join(UPLOADS_DIR, filename);
    const fileBuffer = await fs.readFile(filePath);
    
    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
    */
  } catch (error) {
    console.error('Error serving profile picture:', error);
    return NextResponse.json(
      { error: 'Failed to serve profile picture' },
      { status: 500 },
    );
  }
}
