import * as dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Verify required environment variables
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment variables');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

import {
  addUpstashSystemContent,
  clearAllEOSImplementerNamespaces,
} from '@/lib/ai/upstash-system-rag';

// Updated mapping of folder names to knowledge namespaces - only 4 profiles
const FOLDER_TO_NAMESPACE_MAP: Record<string, string> = {
  'quarterly-session': 'eos-implementer-quarterly-session',
  'focus-day': 'eos-implementer-focus-day',
  'vision-day-1': 'eos-implementer-vision-day-1',
  'vision-day-2': 'eos-implementer-vision-day-2',
};

// Supported file extensions - now including PDF and Word
const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.pdf', '.doc', '.docx'];

interface DocumentInfo {
  filePath: string;
  fileName: string;
  folderName: string;
  namespace: string;
  content: string;
}

/**
 * Extract text from PDF files
 */
async function extractPdfText(filePath: string): Promise<string> {
  try {
    const pdfExtraction = await import('pdf-extraction');

    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);

    // Extract text using pdf-extraction
    const data = await pdfExtraction.default(dataBuffer);

    return data.text || '';
  } catch (error) {
    console.error(`❌ Error parsing PDF ${filePath}:`, error);
    console.warn(
      `   Make sure pdf-extraction is installed: pnpm add pdf-extraction`,
    );
    return '';
  }
}

/**
 * Extract text from Word documents (.doc, .docx)
 */
async function extractWordText(filePath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error(`❌ Error parsing Word document ${filePath}:`, error);
    console.warn(`   Make sure mammoth is installed: npm install mammoth`);
    return '';
  }
}

/**
 * Read and extract text content from various file types
 */
async function extractTextContent(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    switch (ext) {
      case '.md':
      case '.txt':
        return await fs.readFile(filePath, 'utf-8');

      case '.pdf':
        console.log(`📄 Processing PDF: ${path.basename(filePath)}`);
        return await extractPdfText(filePath);

      case '.doc':
      case '.docx':
        console.log(`📄 Processing Word document: ${path.basename(filePath)}`);
        return await extractWordText(filePath);

      default:
        console.warn(`⚠️  Unsupported file type: ${filePath}`);
        return '';
    }
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error);
    return '';
  }
}

/**
 * Recursively find all supported documents in a directory
 */
async function findDocuments(
  dirPath: string,
  folderName: string,
): Promise<DocumentInfo[]> {
  const documents: DocumentInfo[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subDocs = await findDocuments(fullPath, folderName);
        documents.push(...subDocs);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const content = await extractTextContent(fullPath);

          if (content.trim()) {
            const namespace = FOLDER_TO_NAMESPACE_MAP[folderName];
            if (namespace) {
              documents.push({
                filePath: fullPath,
                fileName: entry.name,
                folderName,
                namespace,
                content: content.trim(),
              });
            } else {
              console.warn(`⚠️  No namespace mapping for folder: ${folderName}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error reading directory ${dirPath}:`, error);
  }

  return documents;
}

/**
 * Process and upload a single document
 */
async function uploadDocument(doc: DocumentInfo): Promise<boolean> {
  try {
    console.log(`📄 Processing: ${doc.fileName} → ${doc.namespace}`);

    // Create metadata for the document
    const metadata = {
      fileName: doc.fileName,
      folderName: doc.folderName,
      filePath: doc.filePath,
      uploadedAt: new Date().toISOString(),
      source: 'eos-implementer-documents',
    };

    // Upload to system knowledge base
    await addUpstashSystemContent(
      doc.namespace,
      doc.fileName,
      doc.content,
      metadata,
    );

    console.log(`✅ Uploaded: ${doc.fileName} (${doc.content.length} chars)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${doc.fileName}:`, error);
    return false;
  }
}

/**
 * Main function to process all EOS Implementer documents
 */
async function uploadEOSImplementerDocs() {
  console.log('🚀 Starting EOS Implementer document upload...\n');

  const documentsDir = path.join(process.cwd(), 'eos-implementer-documents');

  // Check if documents directory exists
  try {
    await fs.access(documentsDir);
  } catch (error) {
    console.error(`❌ Documents directory not found: ${documentsDir}`);
    console.error(
      'Please create the eos-implementer-documents directory and add your documents.',
    );
    process.exit(1);
  }

  // Get all folders in the documents directory
  const entries = await fs.readdir(documentsDir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  console.log(`📁 Found folders: ${folders.join(', ')}\n`);

  // Process each folder
  let totalDocuments = 0;
  let successfulUploads = 0;

  for (const folderName of folders) {
    const folderPath = path.join(documentsDir, folderName);
    const namespace = FOLDER_TO_NAMESPACE_MAP[folderName];

    if (!namespace) {
      console.warn(`⚠️  Skipping folder '${folderName}' - no namespace mapping`);
      continue;
    }

    console.log(`\n📂 Processing folder: ${folderName} → ${namespace}`);

    // Find all documents in this folder
    const documents = await findDocuments(folderPath, folderName);

    if (documents.length === 0) {
      console.log(`   No supported documents found in ${folderName}/`);
      continue;
    }

    console.log(`   Found ${documents.length} document(s)`);

    // Upload each document
    for (const doc of documents) {
      totalDocuments++;
      const success = await uploadDocument(doc);
      if (success) {
        successfulUploads++;
      }

      // Add a small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Summary
  console.log(`\n🎉 Upload complete!`);
  console.log(`📊 Summary:`);
  console.log(`   Total documents processed: ${totalDocuments}`);
  console.log(`   Successful uploads: ${successfulUploads}`);
  console.log(`   Failed uploads: ${totalDocuments - successfulUploads}`);

  if (successfulUploads > 0) {
    console.log(
      `\n✨ Documents are now available to EOS Implementer profiles!`,
    );
    console.log(`\nNamespace mappings:`);
    Object.entries(FOLDER_TO_NAMESPACE_MAP).forEach(([folder, namespace]) => {
      console.log(`   ${folder}/ → ${namespace}`);
    });
  }
}

/**
 * Clear all documents from EOS Implementer namespaces (optional cleanup function)
 */
async function clearEOSImplementerDocs() {
  console.log('🧹 Clearing all EOS Implementer documents...\n');

  try {
    const namespaces = Object.values(FOLDER_TO_NAMESPACE_MAP);
    await clearAllEOSImplementerNamespaces(namespaces);
    console.log(`✅ Cleared all documents from EOS Implementer namespaces`);
    console.log(`   Namespaces cleared: ${namespaces.join(', ')}`);
  } catch (error) {
    console.error('❌ Error clearing documents:', error);
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'upload':
      await uploadEOSImplementerDocs();
      break;

    case 'clear':
      await clearEOSImplementerDocs();
      break;

    case 'reset':
      await clearEOSImplementerDocs();
      await uploadEOSImplementerDocs();
      break;

    default:
      console.log('EOS Implementer Document Manager\n');
      console.log('Usage:');
      console.log('  npm run upload-eos-docs upload  - Upload all documents');
      console.log('  npm run upload-eos-docs clear   - Clear all documents');
      console.log(
        '  npm run upload-eos-docs reset   - Clear and re-upload all documents',
      );
      break;
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { uploadEOSImplementerDocs, clearEOSImplementerDocs };
