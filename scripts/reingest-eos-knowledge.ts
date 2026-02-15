#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { Index } from '@upstash/vector';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { generateChunks, generateEmbeddings } from '@/lib/ai/embeddings';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const EOS_FILES_DIR = '/Users/quinnodonnell/Downloads/Eos FIles';
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx']);
const UPSERT_BATCH_SIZE = 100;
const RANGE_PAGE_SIZE = 1000;

type SourceFile = {
  filePath: string;
  fileName: string;
  extension: string;
};

function getLuckySnipeClient(): Index {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN',
    );
  }

  return new Index({ url, token });
}

async function listSourceFilesRecursively(dir: string): Promise<SourceFile[]> {
  const results: SourceFile[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await listSourceFilesRecursively(fullPath);
      results.push(...nested);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    results.push({
      filePath: fullPath,
      fileName: entry.name,
      extension,
    });
  }

  results.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return results;
}

async function extractTextFromFile(file: SourceFile): Promise<string> {
  if (file.extension === '.pdf') {
    const buffer = await fs.readFile(file.filePath);
    const parsed = await pdfParse(buffer);
    return (parsed.text || '').trim();
  }

  if (file.extension === '.docx') {
    const parsed = await mammoth.extractRawText({ path: file.filePath });
    return (parsed.value || '').trim();
  }

  return '';
}

async function clearEntireIndex(client: Index): Promise<number> {
  const allIds: string[] = [];
  let cursor = '';

  console.log('Clearing existing vectors from lucky-snipe index...');

  while (true) {
    const page = await client.range({
      cursor,
      limit: RANGE_PAGE_SIZE,
      includeMetadata: false,
      includeVectors: false,
    });

    allIds.push(...(page.vectors || []).map((vector) => String(vector.id)));

    if (!page.nextCursor) {
      break;
    }

    cursor = page.nextCursor;
  }

  for (let i = 0; i < allIds.length; i += UPSERT_BATCH_SIZE) {
    const batch = allIds.slice(i, i + UPSERT_BATCH_SIZE);
    await client.delete(batch);
  }

  console.log(`Cleared ${allIds.length} existing vectors`);
  return allIds.length;
}

function buildDocumentHash(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex').slice(0, 16);
}

async function reingestFiles(
  client: Index,
  files: SourceFile[],
): Promise<{ totalChars: number; totalChunks: number; totalVectors: number }> {
  let totalChunks = 0;
  let totalVectors = 0;
  let totalChars = 0;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    console.log(`\n[${fileIndex + 1}/${files.length}] ${file.fileName}`);

    try {
      const text = await extractTextFromFile(file);
      if (!text) {
        console.log('  - Skipped (no extractable text)');
        continue;
      }

      totalChars += text.length;
      const chunks = generateChunks(text);

      if (chunks.length === 0) {
        console.log('  - Skipped (no chunks generated)');
        continue;
      }

      const embeddingsData = await generateEmbeddings(chunks);
      const fileHash = buildDocumentHash(file.filePath);
      const nowIso = new Date().toISOString();

      const vectors = embeddingsData.map(({ chunk, embedding }, chunkIndex) => ({
        id: `eos-${fileHash}-${chunkIndex}`,
        vector: embedding,
        metadata: {
          fileName: file.fileName,
          chunkIndex,
          createdAt: nowIso,
          chunk,
          sourcePath: file.filePath,
          sourceType: file.extension.replace('.', ''),
        },
      }));

      for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
        const batch = vectors.slice(i, i + UPSERT_BATCH_SIZE);
        await client.upsert(batch);
      }

      totalChunks += chunks.length;
      totalVectors += vectors.length;

      console.log(
        `  - Extracted ${text.length.toLocaleString()} chars, ${chunks.length} chunks, ${vectors.length} vectors`,
      );
    } catch (error) {
      console.error(`  - Failed: ${file.fileName}`, error);
    }
  }

  console.log('\nRe-ingest complete');
  console.log(`Files processed: ${files.length}`);
  console.log(`Total extracted chars: ${totalChars.toLocaleString()}`);
  console.log(`Total chunks: ${totalChunks.toLocaleString()}`);
  console.log(`Total vectors upserted: ${totalVectors.toLocaleString()}`);
  return { totalChars, totalChunks, totalVectors };
}

async function main() {
  const client = getLuckySnipeClient();

  const files = await listSourceFilesRecursively(EOS_FILES_DIR);
  console.log(`Found ${files.length} supported files in "${EOS_FILES_DIR}"`);

  if (files.length === 0) {
    throw new Error(
      `No supported files found. Expected PDF/DOCX files in ${EOS_FILES_DIR}`,
    );
  }

  await clearEntireIndex(client);
  const totals = await reingestFiles(client, files);
  const info = await client.info();

  console.log(
    `Post-run index vector count: ${info.vectorCount.toLocaleString()}`,
  );
  if (info.vectorCount !== totals.totalVectors) {
    console.warn(
      `Warning: expected ${totals.totalVectors.toLocaleString()} vectors from this ingest, but index currently reports ${info.vectorCount.toLocaleString()}`,
    );
  }
}

main().catch((error) => {
  console.error('Re-ingest failed:', error);
  process.exit(1);
});
