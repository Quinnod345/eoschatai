import * as dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import pdf from 'pdf-parse';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Upstash client for EOS Implementer documents
const getUpstashClient = () => {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  return new Index({
    url,
    token,
  });
};

// Profile to namespace mapping
const PROFILE_NAMESPACES = {
  'vision-day-1': 'eos-implementer-vision-day-1',
  'vision-day-2': 'eos-implementer-vision-day-2',
  'quarterly-session': 'eos-implementer-quarterly-session',
  'focus-day': 'eos-implementer-focus-day',
};

// Extract text from PDF
async function extractPdfText(filePath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text || '';
  } catch (error) {
    console.error(`Error extracting PDF ${filePath}:`, error);
    return '';
  }
}

// Split text into chunks with overlap
function splitIntoChunks(
  text: string,
  chunkSize = 1000,
  overlap = 200,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end === text.length) break;
    start = end - overlap;
  }

  return chunks;
}

// Process a single document
async function processDocument(
  filePath: string,
  fileName: string,
  namespace: string,
  client: Index,
) {
  console.log(`Processing ${fileName} for namespace ${namespace}`);

  try {
    // Extract text from PDF
    const text = await extractPdfText(filePath);
    if (!text) {
      console.error(`No text extracted from ${fileName}`);
      return;
    }

    console.log(`Extracted ${text.length} characters from ${fileName}`);

    // Split into chunks
    const chunks = splitIntoChunks(text);
    console.log(`Split into ${chunks.length} chunks`);

    // Process each chunk
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate embedding
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-ada-002'),
        value: chunk,
      });

      // Create vector with metadata
      const vector = {
        id: `${namespace}-${fileName}-chunk-${i}`,
        vector: embedding,
        metadata: {
          namespace,
          fileName,
          title: fileName.replace('.pdf', '').replace(/-/g, ' '),
          content: chunk,
          chunkIndex: i,
          totalChunks: chunks.length,
          source: 'eos-implementer-documents',
          uploadedAt: new Date().toISOString(),
        },
      };

      vectors.push(vector);
    }

    // Upsert vectors to Upstash in batches
    const batchSize = 50;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await client.upsert(batch, { namespace });
      console.log(
        `Uploaded batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(vectors.length / batchSize)}`,
      );
    }

    console.log(
      `✅ Successfully uploaded ${vectors.length} chunks for ${fileName}`,
    );
  } catch (error) {
    console.error(`❌ Error processing ${fileName}:`, error);
  }
}

// Main function
async function main() {
  console.log('🚀 Starting EOS Implementer document upload to Upstash\n');

  const client = getUpstashClient();
  const baseDir = path.join(process.cwd(), 'eos-implementer-documents');

  // Process each profile directory
  for (const [profileDir, namespace] of Object.entries(PROFILE_NAMESPACES)) {
    const dirPath = path.join(baseDir, profileDir);

    try {
      const files = await fs.readdir(dirPath);
      const pdfFiles = files.filter((f) => f.endsWith('.pdf'));

      console.log(
        `\n📁 Processing ${profileDir} (${pdfFiles.length} PDFs) → ${namespace}`,
      );

      // Clear existing vectors in namespace (optional)
      console.log(`Clearing existing vectors in ${namespace}...`);
      try {
        // List and delete existing vectors
        const existingVectors = await client.list({
          prefix: namespace,
          namespace,
        });

        if (existingVectors && existingVectors.length > 0) {
          const ids = existingVectors.map((v) => v.id);
          await client.delete(ids, { namespace });
          console.log(`Deleted ${ids.length} existing vectors`);
        }
      } catch (err) {
        console.log('No existing vectors to clear');
      }

      // Process each PDF
      for (const file of pdfFiles) {
        const filePath = path.join(dirPath, file);
        await processDocument(filePath, file, namespace, client);

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error processing ${profileDir}:`, error);
    }
  }

  console.log('\n✅ Upload complete!');

  // Test search to verify
  console.log('\n🔍 Testing search...');
  try {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: 'where to start',
    });

    const results = await client.query({
      vector: embedding,
      topK: 3,
      includeMetadata: true,
      namespace: 'eos-implementer-vision-day-1',
    });

    console.log(`Found ${results.length} results for "where to start"`);
    results.forEach((r, i) => {
      console.log(
        `${i + 1}. Score: ${r.score.toFixed(3)} - ${r.metadata?.title || 'Unknown'}`,
      );
    });
  } catch (error) {
    console.error('Test search failed:', error);
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
