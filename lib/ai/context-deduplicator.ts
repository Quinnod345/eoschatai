import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

export interface ContentChunk {
  content: string;
  source: string;
  relevance: number;
  category?: string;
}

/**
 * Calculate cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score (0-1)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Cluster similar chunks together based on semantic similarity
 * @param chunks - Array of content chunks
 * @param similarityThreshold - Minimum similarity to consider chunks duplicates (default: 0.8)
 * @returns Clustered chunks
 */
async function clusterSimilarChunks(
  chunks: ContentChunk[],
  similarityThreshold: number = 0.8,
): Promise<ContentChunk[][]> {
  if (chunks.length === 0) {
    return [];
  }

  console.log(
    `Deduplicator: Clustering ${chunks.length} chunks with threshold ${similarityThreshold}`,
  );

  // Generate embeddings for all chunks
  const embeddings: number[][] = [];
  
  try {
    for (const chunk of chunks) {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-ada-002'),
        value: chunk.content,
      });
      embeddings.push(embedding);
    }
  } catch (error) {
    console.error('Deduplicator: Error generating embeddings:', error);
    // Fallback: Treat all chunks as unique
    return chunks.map((chunk) => [chunk]);
  }

  // Cluster chunks by similarity
  const clusters: ContentChunk[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < chunks.length; i++) {
    if (assigned.has(i)) continue;

    const cluster: ContentChunk[] = [chunks[i]];
    assigned.add(i);

    // Find all similar chunks
    for (let j = i + 1; j < chunks.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);

      if (similarity >= similarityThreshold) {
        cluster.push(chunks[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  console.log(
    `Deduplicator: Formed ${clusters.length} clusters from ${chunks.length} chunks`,
  );

  return clusters;
}

/**
 * Deduplicate content chunks across multiple sources
 * Keeps the highest relevance chunk from each cluster
 * @param chunks - Array of content chunks
 * @param similarityThreshold - Similarity threshold for deduplication (default: 0.8)
 * @returns Deduplicated chunks
 */
export async function deduplicateContextChunks(
  chunks: ContentChunk[],
  similarityThreshold: number = 0.8,
): Promise<ContentChunk[]> {
  if (chunks.length === 0) {
    return [];
  }

  console.log(`Deduplicator: Starting deduplication of ${chunks.length} chunks`);

  try {
    // Cluster similar chunks
    const clusters = await clusterSimilarChunks(chunks, similarityThreshold);

    // From each cluster, keep the chunk with highest relevance
    const deduplicated = clusters.map((cluster) => {
      if (cluster.length === 1) {
        return cluster[0];
      }

      // Log duplicates found
      console.log(
        `Deduplicator: Found ${cluster.length} similar chunks, keeping best one`,
      );
      cluster.forEach((chunk, idx) => {
        console.log(
          `  ${idx + 1}. [${chunk.source}] Relevance: ${chunk.relevance.toFixed(3)} - "${chunk.content.substring(0, 80)}..."`,
        );
      });

      // Return chunk with highest relevance
      return cluster.reduce((best, current) =>
        current.relevance > best.relevance ? current : best,
      );
    });

    const removedCount = chunks.length - deduplicated.length;
    console.log(
      `Deduplicator: Removed ${removedCount} duplicate chunks (${((removedCount / chunks.length) * 100).toFixed(1)}%)`,
    );

    return deduplicated;
  } catch (error) {
    console.error('Deduplicator: Error during deduplication:', error);
    // Fallback: Return all chunks
    return chunks;
  }
}

/**
 * Deduplicate chunks with simple text-based comparison (faster, no embeddings)
 * @param chunks - Array of content chunks
 * @param exactMatch - Whether to require exact match (default: false uses substring matching)
 * @returns Deduplicated chunks
 */
export function deduplicateByText(
  chunks: ContentChunk[],
  exactMatch: boolean = false,
): ContentChunk[] {
  if (chunks.length === 0) {
    return [];
  }

  console.log(
    `Deduplicator: Text-based deduplication of ${chunks.length} chunks`,
  );

  const seen = new Map<string, ContentChunk>();

  for (const chunk of chunks) {
    const key = exactMatch
      ? chunk.content
      : chunk.content.toLowerCase().trim();

    if (!seen.has(key)) {
      seen.set(key, chunk);
    } else {
      // If duplicate, keep the one with higher relevance
      const existing = seen.get(key)!;
      if (chunk.relevance > existing.relevance) {
        seen.set(key, chunk);
      }
    }
  }

  const deduplicated = Array.from(seen.values());
  const removedCount = chunks.length - deduplicated.length;

  console.log(
    `Deduplicator: Removed ${removedCount} duplicate chunks via text matching`,
  );

  return deduplicated;
}

/**
 * Merge overlapping chunks from the same source
 * @param chunks - Array of content chunks
 * @param overlapThreshold - Minimum character overlap to consider merging (default: 50)
 * @returns Merged chunks
 */
export function mergeOverlappingChunks(
  chunks: ContentChunk[],
  overlapThreshold: number = 50,
): ContentChunk[] {
  if (chunks.length === 0) {
    return [];
  }

  console.log(
    `Deduplicator: Merging overlapping chunks with threshold ${overlapThreshold}`,
  );

  // Group by source
  const bySource = chunks.reduce(
    (acc, chunk) => {
      if (!acc[chunk.source]) {
        acc[chunk.source] = [];
      }
      acc[chunk.source].push(chunk);
      return acc;
    },
    {} as Record<string, ContentChunk[]>,
  );

  const merged: ContentChunk[] = [];

  for (const source in bySource) {
    const sourceChunks = bySource[source];

    if (sourceChunks.length === 1) {
      merged.push(sourceChunks[0]);
      continue;
    }

    // Sort by content length (process shorter chunks first)
    sourceChunks.sort((a, b) => a.content.length - b.content.length);

    const toMerge = [...sourceChunks];
    const processed = new Set<number>();

    for (let i = 0; i < toMerge.length; i++) {
      if (processed.has(i)) continue;

      let current = toMerge[i];
      processed.add(i);

      // Check for overlaps with remaining chunks
      for (let j = i + 1; j < toMerge.length; j++) {
        if (processed.has(j)) continue;

        const other = toMerge[j];

        // Check if current is substring of other
        if (other.content.includes(current.content)) {
          console.log(
            `Deduplicator: Merged chunk from ${source} (substring found)`,
          );
          current = {
            ...other,
            relevance: Math.max(current.relevance, other.relevance),
          };
          processed.add(j);
        }
        // Check for overlap at boundaries
        else {
          const overlapStart = findOverlap(current.content, other.content);
          const overlapEnd = findOverlap(other.content, current.content);

          if (overlapStart >= overlapThreshold || overlapEnd >= overlapThreshold) {
            console.log(
              `Deduplicator: Merged chunks from ${source} (${Math.max(overlapStart, overlapEnd)} char overlap)`,
            );
            // Merge the chunks
            current = {
              content:
                overlapStart >= overlapEnd
                  ? current.content + other.content.substring(overlapStart)
                  : other.content + current.content.substring(overlapEnd),
              source,
              relevance: Math.max(current.relevance, other.relevance),
              category: current.category || other.category,
            };
            processed.add(j);
          }
        }
      }

      merged.push(current);
    }
  }

  const removedCount = chunks.length - merged.length;
  console.log(
    `Deduplicator: Merged ${removedCount} overlapping chunks`,
  );

  return merged;
}

/**
 * Find overlap between two strings
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Length of overlap
 */
function findOverlap(str1: string, str2: string): number {
  let maxOverlap = 0;
  const minLen = Math.min(str1.length, str2.length);

  for (let i = 1; i <= minLen; i++) {
    const end1 = str1.substring(str1.length - i);
    const start2 = str2.substring(0, i);

    if (end1 === start2) {
      maxOverlap = i;
    }
  }

  return maxOverlap;
}

