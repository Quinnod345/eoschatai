#!/usr/bin/env node

// This script directly uploads documents to Upstash Vector without relying on dynamic imports
require('dotenv').config({
  path: require('node:path').resolve(process.cwd(), '.env.local'),
});
const fs = require('node:fs');
const path = require('node:path');
const { Index } = require('@upstash/vector');
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');

// Try to load PDF parser if available
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.log('PDF parser not available. PDF files will be skipped.');
  console.log('To enable PDF support, run: npm install pdf-parse');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Upstash Vector client
const upstashVectorClient = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

// Supported file types
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.pdf'];

// Chunk content with overlap for more dense representation
function generateChunks(content, fileExt) {
  // Adjust chunk sizes based on file type
  const maxChunkSize = fileExt === '.pdf' ? 300 : 200;
  const overlapSize = fileExt === '.pdf' ? 50 : 100;

  // Split content into sentences for text and markdown files
  // For PDFs, split by paragraphs first, then by sentences within large paragraphs
  let sentences = [];

  if (fileExt === '.pdf') {
    // For PDFs, first split by paragraphs
    const paragraphs = content.split(/\n\s*\n/);

    // Then process each paragraph
    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxChunkSize) {
        // Small paragraphs can be chunks themselves
        sentences.push(paragraph);
      } else {
        // Large paragraphs need to be split into sentences
        const paragraphSentences = paragraph.split(/(?<=[.!?])\s+/);
        sentences.push(...paragraphSentences);
      }
    }

    // For large PDFs, limit the number of chunks
    const maxPdfChunks = 2000;
    if (sentences.length > maxPdfChunks * 2) {
      console.log(
        `PDF has too many potential chunks (${sentences.length}). Simplifying...`,
      );
      // Combine adjacent sentences to reduce chunk count
      const simplifiedSentences = [];
      for (let i = 0; i < sentences.length; i += 2) {
        if (i + 1 < sentences.length) {
          simplifiedSentences.push(`${sentences[i]} ${sentences[i + 1]}`);
        } else {
          simplifiedSentences.push(sentences[i]);
        }
      }
      sentences = simplifiedSentences;
    }
  } else {
    // For non-PDFs, split by sentences
    sentences = content.split(/(?<=[.!?])\s+/);
  }

  const chunks = [];
  let currentChunk = '';
  let lastAddedSentences = [];

  for (const sentence of sentences) {
    // If adding this sentence keeps chunk under max size, add it
    if (currentChunk.length + sentence.length <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      lastAddedSentences.push(sentence);
    } else {
      // Save the current chunk if it's not empty
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // For overlap, take the last few sentences based on file type
      const overlapCount = fileExt === '.pdf' ? 1 : 3;
      const overlapSentences = lastAddedSentences.slice(-overlapCount);
      currentChunk = overlapSentences.join(' ');

      // Reset the tracking of last added sentences, keeping only the overlap
      lastAddedSentences = [...overlapSentences];

      // Add the current sentence to the new chunk
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      lastAddedSentences.push(sentence);
    }
  }

  // Add the final chunk if it exists
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // For text and markdown files, we can add sliding window chunks
  // But skip this for PDFs to avoid generating too many chunks
  if (
    !fileExt.includes('pdf') &&
    chunks.length < 100 &&
    sentences.length > 20
  ) {
    // Create additional sliding window chunks
    const slidingChunks = [];
    const windowSize = Math.floor(sentences.length / 10);

    for (
      let i = 0;
      i < sentences.length - windowSize;
      i += Math.floor(windowSize / 2)
    ) {
      const windowChunk = sentences.slice(i, i + windowSize).join(' ');
      if (windowChunk.length <= maxChunkSize * 1.2) {
        slidingChunks.push(windowChunk);
      }
    }

    // Add these sliding chunks to our main chunks array
    chunks.push(...slidingChunks);
  }

  console.log(`Generated ${chunks.length} chunks (with overlap) from content`);
  return chunks;
}

// Generate embeddings using OpenAI
async function generateEmbeddings(chunks) {
  if (chunks.length === 0) return [];

  // Process in batches to avoid token limits (max ~300k tokens per request)
  const batchSize = 500; // Reduced batch size to avoid token limits
  const embeddingsData = [];

  console.log(
    `Processing ${chunks.length} chunks in batches of ${batchSize}...`,
  );

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}: ${batchChunks.length} chunks`,
    );

    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batchChunks,
      });

      const batchEmbeddings = batchChunks.map((chunk, j) => ({
        chunk,
        embedding: embeddingResponse.data[j].embedding,
      }));

      embeddingsData.push(...batchEmbeddings);
      console.log(
        `Batch ${Math.floor(i / batchSize) + 1} completed: embedded ${batchChunks.length} chunks`,
      );
    } catch (error) {
      console.error(
        `Error embedding batch ${Math.floor(i / batchSize) + 1}:`,
        error.message,
      );
      // If this batch fails, we can still try to process other batches
      console.log('Continuing with next batch...');
    }
  }

  console.log(
    `Completed embedding ${embeddingsData.length} of ${chunks.length} chunks`,
  );
  return embeddingsData;
}

// Function to extract text from PDF
async function extractTextFromPDF(pdfBuffer) {
  if (!pdfParse) {
    console.log('PDF parser not available. Please install pdf-parse package.');
    return '';
  }

  try {
    const data = await pdfParse(pdfBuffer);
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF:', error.message);
    return '';
  }
}

// Read file content based on file type
async function readFileContent(filePath, fileExt) {
  try {
    // For PDF files, use pdf-parse
    if (fileExt === '.pdf') {
      if (!pdfParse) {
        console.log('Skipping PDF file - pdf-parse module not available');
        return '';
      }
      const pdfBuffer = fs.readFileSync(filePath);
      return await extractTextFromPDF(pdfBuffer);
    }

    // For all other text-based files
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return '';
  }
}

// Process a document and store in Upstash Vector
async function processDocument(documentId, content, fileExt) {
  console.log('Processing document...');

  // Generate chunks
  const chunks = generateChunks(content, fileExt);
  console.log(`Generated ${chunks.length} chunks from document`);

  // Generate embeddings
  const embeddingsData = await generateEmbeddings(chunks);
  console.log(
    `Generated embeddings with dimension ${embeddingsData[0]?.embedding.length || 0}`,
  );

  // Store in Upstash Vector
  const vectors = embeddingsData.map(({ chunk, embedding }, index) => ({
    id: `${documentId}-${index}`,
    vector: embedding,
    metadata: {
      documentId,
      chunk,
      createdAt: new Date().toISOString(),
    },
  }));

  // Upsert vectors in batches
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    try {
      await upstashVectorClient.upsert(batch);
      console.log(
        `Stored batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(vectors.length / batchSize)}`,
      );
    } catch (error) {
      console.error(`Error storing vector batch:`, error);
    }
  }

  console.log(
    `Successfully stored ${vectors.length} chunks in vector database`,
  );
  return { documentId, chunkCount: chunks.length };
}

// Process a single file
async function processFile(filePath) {
  try {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();

    // Check if file type is supported
    if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
      console.log(`Skipping unsupported file type: ${fileName}`);
      return null;
    }

    console.log(`Processing file: ${fileName}`);

    // Read file content
    let content = await readFileContent(filePath, fileExt);

    // Check if content was successfully extracted
    if (!content || content.trim().length === 0) {
      console.log(`Skipping file with no content: ${fileName}`);
      return null;
    }

    // Preprocess content for better chunking
    content = preprocessContent(content, fileExt);

    // Generate a unique document ID
    const documentId = uuidv4();

    // Process the document
    await processDocument(documentId, content, fileExt);

    console.log(`Successfully processed ${fileName} with ID: ${documentId}`);

    // Return document mapping
    return {
      id: documentId,
      fileName,
      path: filePath,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return null;
  }
}

// Preprocess content to optimize for chunking and information density
function preprocessContent(content, fileExt) {
  // Remove excessive whitespace
  let processedContent = content.replace(/\s+/g, ' ');

  // For markdown files, keep the structure but simplify
  if (fileExt === '.md') {
    // Replace multiple newlines with single newlines
    processedContent = processedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Ensure headings have proper spacing
    processedContent = processedContent.replace(/\n(#{1,6})/g, '\n\n$1');

    // Ensure list items are properly formatted
    processedContent = processedContent.replace(/\n(-|\*|\d+\.)\s/g, '\n\n$1 ');
  }

  // For PDF content, which can have strange formatting
  if (fileExt === '.pdf') {
    // Replace hyphenated line breaks
    processedContent = processedContent.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');

    // Fix common PDF extraction issues with spacing
    processedContent = processedContent.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
  }

  return processedContent;
}

// Process a directory
async function processDirectory(dirPath) {
  try {
    console.log(`Scanning directory: ${dirPath}`);

    // Read all files in the directory
    const files = fs.readdirSync(dirPath);

    // Storage for document mappings
    const documentMappings = [];

    // Process each file
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
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
      let existingMappings = [];
      try {
        if (fs.existsSync(mappingPath)) {
          const existing = fs.readFileSync(mappingPath, 'utf-8');
          existingMappings = JSON.parse(existing);
        }
      } catch (error) {
        // File doesn't exist or can't be parsed, that's fine
      }

      // Combine and save mappings
      const allMappings = [...existingMappings, ...documentMappings];
      fs.writeFileSync(
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
  }
}

// Main function
async function main() {
  try {
    // Check environment variables
    if (!process.env.UPSTASH_VECTOR_REST_URL) {
      console.error('Error: UPSTASH_VECTOR_REST_URL is missing in .env.local');
      process.exit(1);
    }

    if (!process.env.UPSTASH_VECTOR_REST_TOKEN) {
      console.error(
        'Error: UPSTASH_VECTOR_REST_TOKEN is missing in .env.local',
      );
      process.exit(1);
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('Error: OPENAI_API_KEY is missing in .env.local');
      process.exit(1);
    }

    console.log('Environment variables loaded:');
    console.log(
      ` - UPSTASH_VECTOR_REST_URL: ${process.env.UPSTASH_VECTOR_REST_URL ? 'Set' : 'Missing'}`,
    );
    console.log(
      ` - UPSTASH_VECTOR_REST_TOKEN: ${process.env.UPSTASH_VECTOR_REST_TOKEN ? 'Set' : 'Missing'}`,
    );
    console.log(
      ` - OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set' : 'Missing'}`,
    );

    const directoryPath = process.argv[2];

    if (!directoryPath) {
      console.error(
        'Please provide a directory path containing the documents to process.',
      );
      console.log('Usage: node direct-upload.js ./path/to/documents');
      process.exit(1);
    }

    const fullPath = path.resolve(process.cwd(), directoryPath);

    // Check if directory exists
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      console.error(
        `The path ${fullPath} is not a directory or doesn't exist.`,
      );
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
