import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq, and, sql, } from 'drizzle-orm';

/**
 * Add tags to a composer
 */
export async function addTagsToComposer(
  composerId: string,
  userId: string,
  tags: string[],
): Promise<{ success: boolean; tags: string[] }> {
  try {
    // Get current tags
    const [composer] = await db
      .select({ tags: document.tags })
      .from(document)
      .where(and(eq(document.id, composerId), eq(document.userId, userId)))
      .limit(1);

    if (!composer) {
      throw new Error('Composer not found');
    }

    // Merge tags, avoiding duplicates
    const currentTags = (composer.tags as string[]) || [];
    const newTags = [...new Set([...currentTags, ...tags.map((t) => t.toLowerCase().trim())])];

    // Update the document
    await db
      .update(document)
      .set({ tags: newTags })
      .where(and(eq(document.id, composerId), eq(document.userId, userId)));

    return { success: true, tags: newTags };
  } catch (error) {
    console.error('Error adding tags to composer:', error);
    throw error;
  }
}

/**
 * Remove a tag from a composer
 */
export async function removeTagFromComposer(
  composerId: string,
  userId: string,
  tag: string,
): Promise<{ success: boolean; tags: string[] }> {
  try {
    // Get current tags
    const [composer] = await db
      .select({ tags: document.tags })
      .from(document)
      .where(and(eq(document.id, composerId), eq(document.userId, userId)))
      .limit(1);

    if (!composer) {
      throw new Error('Composer not found');
    }

    // Remove the tag
    const currentTags = (composer.tags as string[]) || [];
    const normalizedTag = tag.toLowerCase().trim();
    const newTags = currentTags.filter((t) => t.toLowerCase() !== normalizedTag);

    // Update the document
    await db
      .update(document)
      .set({ tags: newTags })
      .where(and(eq(document.id, composerId), eq(document.userId, userId)));

    return { success: true, tags: newTags };
  } catch (error) {
    console.error('Error removing tag from composer:', error);
    throw error;
  }
}

/**
 * Set all tags for a composer (replaces existing)
 */
export async function setComposerTags(
  composerId: string,
  userId: string,
  tags: string[],
): Promise<{ success: boolean; tags: string[] }> {
  try {
    const normalizedTags = [...new Set(tags.map((t) => t.toLowerCase().trim()))];

    await db
      .update(document)
      .set({ tags: normalizedTags })
      .where(and(eq(document.id, composerId), eq(document.userId, userId)));

    return { success: true, tags: normalizedTags };
  } catch (error) {
    console.error('Error setting composer tags:', error);
    throw error;
  }
}

/**
 * Get all unique tags used by a user
 */
export async function getUserTags(
  userId: string,
): Promise<Array<{ tag: string; count: number }>> {
  try {
    // Get all composers with tags
    const composers = await db
      .select({ tags: document.tags })
      .from(document)
      .where(eq(document.userId, userId));

    // Count tag occurrences
    const tagCounts: Record<string, number> = {};
    for (const composer of composers) {
      const tags = (composer.tags as string[]) || [];
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    // Sort by count and return
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error getting user tags:', error);
    return [];
  }
}

/**
 * Get popular tags (most used across all composers for a user)
 */
export async function getPopularTags(
  userId: string,
  limit = 20,
): Promise<string[]> {
  const tags = await getUserTags(userId);
  return tags.slice(0, limit).map((t) => t.tag);
}

/**
 * Get composers by tag
 */
export async function getComposersByTag(
  userId: string,
  tag: string,
): Promise<
  Array<{
    id: string;
    title: string;
    kind: string;
    tags: string[];
    createdAt: Date;
  }>
> {
  try {
    const normalizedTag = tag.toLowerCase().trim();

    // Use raw SQL for JSONB array contains
    const composers = await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
        tags: document.tags,
        createdAt: document.createdAt,
      })
      .from(document)
      .where(
        and(
          eq(document.userId, userId),
          sql`${document.tags} @> ${JSON.stringify([normalizedTag])}::jsonb`,
        ),
      );

    type ComposerRow = { id: string; title: string; kind: string; tags: unknown; createdAt: Date };
    return composers.map((c: ComposerRow) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      tags: (c.tags as string[]) || [],
      createdAt: c.createdAt,
    }));
  } catch (error) {
    console.error('Error getting composers by tag:', error);
    return [];
  }
}

/**
 * Search composers by multiple tags (AND)
 */
export async function getComposersByTags(
  userId: string,
  tags: string[],
  matchAll = true,
): Promise<
  Array<{
    id: string;
    title: string;
    kind: string;
    tags: string[];
    matchedTags: string[];
  }>
> {
  type ComposerTagRow = { id: string; title: string; kind: string; tags: unknown };

  try {
    const normalizedTags = tags.map((t) => t.toLowerCase().trim());

    if (matchAll) {
      // Must have all tags
      const composers = await db
        .select({
          id: document.id,
          title: document.title,
          kind: document.kind,
          tags: document.tags,
        })
        .from(document)
        .where(
          and(
            eq(document.userId, userId),
            sql`${document.tags} @> ${JSON.stringify(normalizedTags)}::jsonb`,
          ),
        );

      return composers.map((c: ComposerTagRow) => ({
        id: c.id,
        title: c.title,
        kind: c.kind,
        tags: (c.tags as string[]) || [],
        matchedTags: normalizedTags,
      }));
    } else {
      // Must have any of the tags
      const composers = await db
        .select({
          id: document.id,
          title: document.title,
          kind: document.kind,
          tags: document.tags,
        })
        .from(document)
        .where(eq(document.userId, userId));

      // Filter in memory for "any" matching
      return composers
        .filter((c: ComposerTagRow) => {
          const composerTags = (c.tags as string[]) || [];
          return normalizedTags.some((tag) =>
            composerTags.some((ct) => ct.toLowerCase() === tag),
          );
        })
        .map((c: ComposerTagRow) => {
          const composerTags = (c.tags as string[]) || [];
          const matchedTags = normalizedTags.filter((tag) =>
            composerTags.some((ct) => ct.toLowerCase() === tag),
          );
          return {
            id: c.id,
            title: c.title,
            kind: c.kind,
            tags: composerTags,
            matchedTags,
          };
        });
    }
  } catch (error) {
    console.error('Error getting composers by tags:', error);
    return [];
  }
}

/**
 * Suggest tags based on content
 */
export async function suggestTagsFromContent(
  content: string,
  existingTags: string[] = [],
): Promise<string[]> {
  // Simple keyword extraction (can be enhanced with AI)
  const words = content.toLowerCase().split(/\W+/);
  const wordCounts: Record<string, number> = {};

  // Count word frequencies (excluding common words)
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'that', 'this', 'these', 'those',
    'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
    'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his', 'hers',
  ]);

  for (const word of words) {
    if (
      word.length > 3 &&
      !stopWords.has(word) &&
      !existingTags.includes(word)
    ) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }

  // Get top words as suggested tags
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Rename a tag across all of a user's composers
 */
export async function renameTag(
  userId: string,
  oldTag: string,
  newTag: string,
): Promise<{ updatedCount: number }> {
  try {
    const normalizedOld = oldTag.toLowerCase().trim();
    const normalizedNew = newTag.toLowerCase().trim();

    if (normalizedOld === normalizedNew) {
      return { updatedCount: 0 };
    }

    // Get all composers with the old tag
    const composers = await getComposersByTag(userId, normalizedOld);

    let updatedCount = 0;
    for (const composer of composers) {
      const newTags = composer.tags
        .filter((t) => t.toLowerCase() !== normalizedOld)
        .concat(normalizedNew);

      await db
        .update(document)
        .set({ tags: [...new Set(newTags)] })
        .where(and(eq(document.id, composer.id), eq(document.userId, userId)));

      updatedCount++;
    }

    return { updatedCount };
  } catch (error) {
    console.error('Error renaming tag:', error);
    throw error;
  }
}

/**
 * Delete a tag from all of a user's composers
 */
export async function deleteTag(
  userId: string,
  tag: string,
): Promise<{ updatedCount: number }> {
  try {
    const normalizedTag = tag.toLowerCase().trim();

    // Get all composers with the tag
    const composers = await getComposersByTag(userId, normalizedTag);

    let updatedCount = 0;
    for (const composer of composers) {
      const newTags = composer.tags.filter(
        (t) => t.toLowerCase() !== normalizedTag,
      );

      await db
        .update(document)
        .set({ tags: newTags })
        .where(and(eq(document.id, composer.id), eq(document.userId, userId)));

      updatedCount++;
    }

    return { updatedCount };
  } catch (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
}
