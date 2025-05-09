import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { processDocument } from '../lib/ai/embeddings';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Make sure we have the required variables
const requiredEnvVars = [
  'UPSTASH_VECTOR_REST_TOKEN',
  'UPSTASH_VECTOR_REST_URL',
  'OPENAI_API_KEY',
];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    `Error: Missing required environment variables: ${missingVars.join(', ')}`,
  );
  console.error(
    'Please make sure these variables are set in your .env.local file',
  );
  process.exit(1);
}

// Log confirmation of environment variables
console.log('Environment variables loaded successfully');
console.log(`Vector URL: ${process.env.UPSTASH_VECTOR_REST_URL}`);
console.log(
  `OpenAI API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`,
);

// Supported file types
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.csv'];

/**
 * Process a single file and store its embeddings in Upstash Vector
 */
async function processFile(filePath: string): Promise<
  | {
      id: string;
      fileName: string;
      path: string;
      timestamp: string;
    }
  | undefined
> {
  try {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();

    // Check if file type is supported
    if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
      console.log(`Skipping unsupported file type: ${fileName}`);
      return undefined;
    }

    console.log(`Processing file: ${fileName}`);

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Generate a unique document ID
    const documentId = uuidv4();

    // Process the document (chunk, embed, and store in Upstash Vector)
    await processDocument(documentId, content);

    console.log(`Successfully processed ${fileName} with ID: ${documentId}`);

    // Store the document mapping for reference
    return {
      id: documentId,
      fileName,
      path: filePath,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Process all files in a directory
 */
async function processDirectory(dirPath: string): Promise<void> {
  try {
    console.log(`Scanning directory: ${dirPath}`);

    // Read all files in the directory
    const files = await fs.readdir(dirPath);

    // Storage for document mappings
    const documentMappings: any[] = [];

    // Process each file
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        // Recursively process subdirectories if needed
        // await processDirectory(filePath);
        console.log(`Skipping subdirectory: ${file}`);
      } else {
        const result = await processFile(filePath);
        if (result) {
          documentMappings.push(result);
        }
      }
    }

    // Save document mappings to a reference file
    if (documentMappings.length > 0) {
      const mappingPath = path.join(process.cwd(), 'document-mappings.json');

      // Check if mapping file already exists
      let existingMappings: any[] = [];
      try {
        const existing = await fs.readFile(mappingPath, 'utf-8');
        existingMappings = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist yet, that's fine
      }

      // Combine and save mappings
      const allMappings = [...existingMappings, ...documentMappings];
      await fs.writeFile(
        mappingPath,
        JSON.stringify(allMappings, null, 2),
        'utf-8',
      );

      console.log(`Document mappings saved to: document-mappings.json`);
    }

    console.log(
      `Successfully processed ${documentMappings.length} files from ${dirPath}`,
    );
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    const directoryPath = process.argv[2];

    if (!directoryPath) {
      console.error(
        'Please provide a directory path containing the documents to process.',
      );
      console.log(
        'Usage: npx tsx scripts/upload-documents.ts ./path/to/documents',
      );
      process.exit(1);
    }

    const fullPath = path.resolve(process.cwd(), directoryPath);

    // Check if directory exists
    try {
      const stats = await fs.stat(fullPath);
      if (!stats.isDirectory()) {
        console.error(`The path ${fullPath} is not a directory.`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Directory not found: ${fullPath}`);
      process.exit(1);
    }

    // Process the directory
    await processDirectory(fullPath);

    console.log('Document processing completed successfully!');
  } catch (error) {
    console.error('Error during document processing:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
