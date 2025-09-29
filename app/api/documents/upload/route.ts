import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/app/(auth)/auth';
import { userDocuments } from '@/lib/db/schema';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { sql } from 'drizzle-orm';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import OpenAI from 'openai';
import { processUserDocument } from '@/lib/ai/user-rag';
import {
  getAccessContext,
  incrementUsageCounter,
  broadcastEntitlementsUpdated,
} from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';

const createOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      '[documents.upload] OPENAI_API_KEY missing; advanced document analysis disabled.',
    );
    return null;
  }

  return new OpenAI({ apiKey });
};

const openai = createOpenAIClient();

// Extract text from different file types
async function extractTextFromFile(
  file: Blob,
  fileType: string,
  fileName: string,
): Promise<string> {
  // For plain text files
  if (fileType.includes('text/') || fileType.includes('markdown')) {
    const text = await file.text();
    return text;
  }

  // For PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      console.log(`Parsing PDF file: ${fileName}, size: ${file.size} bytes`);

      // First try normal PDF text extraction
      const buffer = await file.arrayBuffer();
      console.log(`PDF buffer created with ${buffer.byteLength} bytes`);

      try {
        const data = await pdfParse(Buffer.from(buffer));
        console.log(`PDF parsed successfully with ${data.numpages} page(s)`);

        // Extract and clean the text
        const pdfText = data.text || '';
        console.log(
          `PDF text extraction completed. Extracted ${pdfText.length} characters.`,
        );

        // If we got enough text from standard parsing, use it
        if (pdfText && pdfText.trim().length > 100) {
          console.log(
            `Successfully extracted text from PDF. First 100 chars: ${pdfText.substring(0, 100).replace(/\n/g, ' ')}`,
          );
          return pdfText;
        }

        // If not enough text was extracted, use OpenAI Vision
        console.log(
          "Standard PDF parsing didn't extract sufficient text. Using OpenAI text analysis.",
        );

        try {
          // For PDFs, we need to convert to images first
          // This is a simplified approach - in a production app, you might want to:
          // 1. Convert PDF to images using pdf2image or similar
          // 2. Process each page as a separate image

          // For now, we'll use a simpler approach with text extraction
          console.log(
            'Using OpenAI text processing instead of vision for PDF content',
          );

          // Extract whatever text we can get from standard parsing
          const textFromPdf =
            data?.text || 'Limited text could be extracted from this PDF';

          // Use OpenAI to analyze the text content and provide a description
          if (!openai) {
            console.warn(
              '[documents.upload] OpenAI unavailable; returning raw PDF extraction.',
            );
            return (
              pdfText ||
              `OpenAI analysis unavailable for PDF ${fileName}. Provide additional context manually.`
            );
          }

          const response = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'user',
                content: `This is text extracted from a PDF file named "${fileName}". The text extraction might be incomplete or imperfect. 
                Please analyze this content and provide both a cleaned version of the text and a comprehensive description of what the document appears to contain.
                
                EXTRACTED TEXT FROM PDF:
                ${textFromPdf}
                
                Respond in this format:
                ### EXTRACTED TEXT
                [Provide a cleaned, well-formatted version of the extracted text]
                
                ### DOCUMENT SUMMARY
                [Provide a detailed 2-3 paragraph summary explaining what this document appears to be, its purpose, key information it contains, and its structure]`,
              },
            ],
            max_completion_tokens: 4000,
          });

          console.log(
            `OpenAI text analysis returned a response with ${response.choices[0].message.content?.length || 0} characters`,
          );

          // Return the enhanced text and description
          return (
            response.choices[0].message.content ||
            `Failed to extract content from PDF file ${fileName} using AI analysis.`
          );
        } catch (openaiError) {
          console.error('Error using OpenAI for PDF analysis:', openaiError);

          // Fallback to whatever text we could extract
          if (pdfText && pdfText.trim().length > 0) {
            console.log('Falling back to standard PDF text extraction');
            return pdfText;
          }

          return `Error analyzing PDF file ${fileName}. Unable to extract text content: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`;
        }
      } catch (pdfParseError) {
        console.log(
          `Standard PDF parsing failed: ${pdfParseError}. Using OpenAI processing.`,
        );

        // If standard parsing failed completely, we'll use a more general approach with OpenAI
        try {
          console.log('Using OpenAI for PDF filename and metadata analysis');

          // Use OpenAI to provide a description based on the filename and metadata
          if (!openai) {
            console.warn(
              '[documents.upload] OpenAI unavailable; unable to analyze PDF metadata.',
            );
            return `PDF ${fileName} could not be analyzed because the OpenAI API key is missing.`;
          }

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: `I have a PDF file named "${fileName}" that could not be parsed for text extraction. The file is ${Math.round(file.size / 1024)} KB in size.
                
                Based on the filename and any other information, please:
                1. Provide a likely description of what this document might contain
                2. Create a placeholder text representation that could serve as context for this document
                
                Respond in this format:
                ### DOCUMENT SUMMARY
                [A detailed description of what this document likely contains, based on its filename]
                
                ### PLACEHOLDER CONTENT
                [Create a structured representation of what this type of document typically contains, which can be used as AI context]`,
              },
            ],
            max_completion_tokens: 4000,
          });

          console.log(
            `OpenAI analysis returned a response with ${response.choices[0].message.content?.length || 0} characters`,
          );

          // Return the description and placeholder content
          return (
            response.choices[0].message.content ||
            `Failed to extract content from PDF file ${fileName}. This appears to be a file named ${fileName} that could not be analyzed in detail.`
          );
        } catch (openaiError) {
          console.error(
            'Error using OpenAI for PDF filename analysis:',
            openaiError,
          );
          return `Error analyzing PDF file ${fileName}. The file could not be processed: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`;
        }
      }
    } catch (error) {
      console.error('Error processing PDF file:', error);
      return `Error extracting content from PDF file ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // For Excel files
  if (
    fileType.includes('spreadsheet') ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      let content = '';

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        content += `## Sheet: ${sheetName}\n\n`;

        // Convert to CSV for better text representation
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        content += `${csv}\n\n`;
      });

      return content;
    } catch (error) {
      console.error('Error processing Excel file:', error);
      return `Error extracting content from Excel file ${fileName}`;
    }
  }

  // For Word documents (.docx only)
  if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
    try {
      // Extract text from docx using JSZip
      const buffer = await file.arrayBuffer();
      const zip = new JSZip();
      const content = await zip.loadAsync(buffer);

      // Get the document.xml file that contains the content
      const documentXml = await content
        .file('word/document.xml')
        ?.async('text');

      if (!documentXml) {
        return `Could not extract text from DOCX file ${fileName}`;
      }

      // Very simple extraction of text content - in production, use a more robust method
      let extractedText = '';

      // Extract text from XML tags using regex (simplistic approach)
      const tagMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (tagMatches) {
        extractedText = tagMatches
          .map((match) => {
            // Extract content between tags
            const content = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
            return content;
          })
          .join(' ');
      }

      return (
        extractedText || `Could not extract text from DOCX file ${fileName}`
      );
    } catch (error) {
      console.error('Error processing Word document:', error);
      return `Error extracting content from Word document ${fileName}`;
    }
  }

  // For file types that aren't specifically handled
  return `File type ${fileType} (${fileName}) is not fully supported for text extraction. Please upload a PDF, TXT, DOCX, or XLSX file for better results.`;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const db = await import('@/lib/db').then((module) => module.db);

  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;
    const category = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 },
      );
    }

    // Validate category
    const validCategories = [
      'Scorecard',
      'VTO',
      'Rocks',
      'A/C',
      'Core Process',
      'Other',
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size should be less than 10MB' },
        { status: 400 },
      );
    }

    // Get filename and content type
    const fileName = (formData.get('file') as File).name;
    const fileType = file.type;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    // Also check file extension for types that might not be correctly identified
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx'];

    if (
      !validTypes.includes(fileType) &&
      !validExtensions.includes(fileExt || '')
    ) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${fileName}. Only PDF, TXT, MD, DOC, DOCX, XLS, and XLSX files are supported.`,
        },
        { status: 400 },
      );
    }

    // Extract text content from the file
    const textContent = await extractTextFromFile(file, fileType, fileName);

    // Upload file to Vercel Blob
    const { url } = await put(
      `user-documents/${session.user.id}/${Date.now()}-${fileName}`,
      file,
      {
        access: 'public',
      },
    );

    // Ensure the fileType is not too long (max 255 chars)
    const trimmedFileType = fileType.substring(0, 250);

    // Store document info in database with fields that are safely trimmed
    try {
      // Create a valid category value from the enum
      const validCategory = category as
        | 'Scorecard'
        | 'VTO'
        | 'Rocks'
        | 'A/C'
        | 'Core Process'
        | 'Other';

      const newDocument = await db
        .insert(userDocuments)
        .values({
          userId: session.user.id,
          fileName: fileName.substring(0, 250), // Ensure fileName is not too long
          fileUrl: url,
          fileSize: file.size,
          fileType: trimmedFileType,
          category: validCategory,
          content: textContent,
        })
        .returning();

      // Process the document for User RAG
      try {
        console.log(`Processing document for User RAG: ${fileName}`);
        await processUserDocument(
          session.user.id,
          newDocument[0].id,
          textContent,
          {
            fileName: fileName,
            category: validCategory,
            fileType: trimmedFileType,
          },
        );
        console.log(
          `Successfully processed document for User RAG: ${fileName}`,
        );
      } catch (ragError) {
        console.error('Error processing document for User RAG:', ragError);
        // Don't fail the upload if RAG processing fails
      }

      await incrementUsageCounter(session.user.id, 'uploads_total', 1);
      await broadcastEntitlementsUpdated(session.user.id);

      return NextResponse.json({
        message: 'Document uploaded successfully',
        document: {
          id: newDocument[0].id,
          fileName: newDocument[0].fileName,
          category: newDocument[0].category,
        },
      });
    } catch (error) {
      console.error('Error inserting document into database:', error);

      // Try a direct SQL approach as a fallback
      try {
        const result = await db.execute(
          sql`INSERT INTO "UserDocuments" ("userId", "fileName", "fileUrl", "fileSize", "fileType", "category", "content", "createdAt", "updatedAt")
              VALUES (${session.user.id}, ${fileName.substring(0, 250)}, ${url}, ${file.size}, ${trimmedFileType}, ${category}, ${textContent}, NOW(), NOW())
              RETURNING "id", "fileName", "category"`,
        );

        // Extract result data safely
        const returnedData = result as unknown as {
          rows: Array<{ id: string; fileName: string; category: string }>;
        };

        await incrementUsageCounter(session.user.id, 'uploads_total', 1);
        await broadcastEntitlementsUpdated(session.user.id);

        return NextResponse.json({
          message: 'Document uploaded successfully (fallback method)',
          document: {
            id: returnedData.rows?.[0]?.id || 'unknown',
            fileName: returnedData.rows?.[0]?.fileName || fileName,
            category: returnedData.rows?.[0]?.category || category,
          },
        });
      } catch (fallbackError) {
        console.error('Fallback insertion also failed:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to upload document to database' },
          { status: 500 },
        );
      }
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 },
    );
  }
}
