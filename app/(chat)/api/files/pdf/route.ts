import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

// Maximum PDF size (5MB)
const MAX_PDF_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      console.error('PDF processing: No file uploaded');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      console.error(`PDF processing: Invalid file type ${file.type}`);
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 },
      );
    }

    if (file.size > MAX_PDF_SIZE) {
      console.error(`PDF processing: File too large (${file.size} bytes)`);
      return NextResponse.json(
        {
          error: `PDF size exceeds the maximum allowed size of ${MAX_PDF_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    // Convert Blob to Buffer for pdf-parse
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`PDF processing: File size ${buffer.length} bytes`);

    try {
      const data = await pdfParse(buffer);

      // Get the raw text from the PDF
      const text = data.text || '';

      console.log(
        `PDF processing: Successfully extracted ${text.length} characters`,
      );

      return NextResponse.json({
        filename: (file as File).name || 'document.pdf',
        text: text,
        numPages: data.numpages || 1,
        info: {
          producer: data.info?.Producer || '',
          creator: data.info?.Creator || '',
        },
      });
    } catch (pdfError: any) {
      console.error('PDF parsing error:', pdfError);
      return NextResponse.json(
        {
          error: `Failed to parse PDF: ${pdfError.message || 'Unknown error'}`,
        },
        { status: 422 },
      );
    }
  } catch (error: any) {
    console.error('PDF processing request error:', error);
    return NextResponse.json(
      {
        error: `Server error processing PDF: ${error.message || 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
}
