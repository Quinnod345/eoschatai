import * as XLSX from 'xlsx';
import JSZip from 'jszip';

/**
 * Extract text content from various document formats
 */
export async function parseDocumentContent(file: File): Promise<string> {
  const fileType = file.type;
  const fileExt = file.name.split('.').pop()?.toLowerCase();

  // Handle plain text files
  if (fileType.includes('text/') || fileType.includes('markdown')) {
    return await file.text();
  }

  // Handle PDF files
  if (fileType === 'application/pdf' || fileExt === 'pdf') {
    console.log(`Client-side preview for PDF file: ${file.name}`);
    // PDF parsing requires the server-side component with AI processing
    return `# Enhanced PDF Processing
    
Your PDF "${file.name}" (${Math.round(file.size / 1024)} KB) will be processed using advanced AI technology that:

1. Extracts all visible text from the document
2. Generates a comprehensive description of the document's content
3. Analyzes the structure and purpose of the document
4. Works even with scanned PDFs or images embedded in PDFs

The AI will process your document upon upload and make it fully searchable and accessible to the chatbot. This allows the AI to understand and reference your documents in much greater detail.

For best results:
- Ensure PDFs are clear and readable
- Keep them under 10MB for faster processing
- Allow a few moments for AI analysis to complete`;
  }

  // Handle Excel files
  if (
    fileType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel' ||
    fileExt === 'xlsx' ||
    fileExt === 'xls'
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      let textContent = '';

      // Process each sheet
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        textContent += `## Sheet: ${sheetName}\n\n`;

        // Convert to JSON for easier handling
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Format as plain text table
        jsonData.forEach((row: any) => {
          if (Array.isArray(row) && row.length > 0) {
            textContent += `${row.join('\t')}\n`;
          }
        });

        textContent += '\n';
      });

      return textContent;
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return `Error parsing Excel file: ${file.name}. ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    }
  }

  // Handle Word documents
  if (
    fileType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileType === 'application/msword' ||
    fileExt === 'docx' ||
    fileExt === 'doc'
  ) {
    try {
      // For DOCX, use JSZip to extract content
      if (fileExt === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const zip = new JSZip();
        const content = await zip.loadAsync(arrayBuffer);

        // Extract document.xml
        const documentXml = await content
          .file('word/document.xml')
          ?.async('text');

        if (documentXml) {
          // Simple extraction of text content
          let extractedText = '';

          // Extract text from XML tags
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

          if (extractedText) {
            return extractedText;
          }
        }
      }

      return `Word document content will be extracted on the server. Your document "${file.name}" (${Math.round(file.size / 1024)} KB) will be fully parsed after upload.`;
    } catch (error) {
      console.error('Error parsing Word document:', error);
      return `Error parsing Word document: ${file.name}`;
    }
  }

  // Default fallback
  return `Preview not available for this file type (${fileType}). The file will be processed on the server after upload.`;
}
