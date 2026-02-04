import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm';
import type { ComposerMentionInstance, ComposerKind } from './types';
import {
  COMPOSER_KIND_TO_MENTION_TYPE,
  COMPOSER_KIND_ICONS,
  COMPOSER_KIND_DISPLAY_NAMES,
} from './types';

export interface ComposerFetchOptions {
  search?: string;
  kind?: ComposerKind | 'all';
  limit?: number;
  sortBy?: 'recent' | 'accessed' | 'mentioned' | 'title';
}

/**
 * Fetch composers from the database with smart sorting and filtering
 */
export async function fetchComposersForMention(
  userId: string,
  options: ComposerFetchOptions = {},
): Promise<ComposerMentionInstance[]> {
  const { search = '', kind = 'all', limit = 10, sortBy = 'accessed' } = options;

  try {
    // Build the where conditions
    const conditions = [eq(document.userId, userId)];

    // Filter by kind if specified
    if (kind !== 'all') {
      conditions.push(eq(document.kind, kind as typeof document.kind.enumValues[number]));
    }

    // Add search condition if search term provided
    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(document.title, searchPattern),
          ilike(document.contentSummary, searchPattern),
          // Search in tags (JSONB contains)
          sql`${document.tags}::text ILIKE ${searchPattern}`,
        ) as any,
      );
    }

    // Determine sort order
    let orderBy;
    switch (sortBy) {
      case 'accessed':
        orderBy = desc(sql`COALESCE(${document.lastAccessedAt}, ${document.createdAt})`);
        break;
      case 'mentioned':
        orderBy = desc(sql`COALESCE(${document.mentionCount}, 0)`);
        break;
      case 'title':
        orderBy = document.title;
        break;
      case 'recent':
      default:
        orderBy = desc(document.createdAt);
    }

    // Execute query
    const composers = await db
      .select({
        id: document.id,
        title: document.title,
        content: document.content,
        contentSummary: document.contentSummary,
        kind: document.kind,
        tags: document.tags,
        category: document.category,
        viewCount: document.viewCount,
        editCount: document.editCount,
        mentionCount: document.mentionCount,
        lastAccessedAt: document.lastAccessedAt,
        createdAt: document.createdAt,
        userId: document.userId,
        isContext: document.isContext,
      })
      .from(document)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit);

    // Transform to ComposerMentionInstance format
    type ComposerFetchRow = {
      id: string;
      title: string;
      content: string | null;
      contentSummary: string | null;
      kind: string;
      tags: unknown;
      category: string | null;
      viewCount: number | null;
      editCount: number | null;
      mentionCount: number | null;
      lastAccessedAt: Date | null;
      createdAt: Date;
      userId: string;
      isContext: boolean | null;
    };
    return composers.map((composer: ComposerFetchRow) => {
      const composerKind = composer.kind as ComposerKind;
      
      // Create preview from content or summary
      let preview = composer.contentSummary || '';
      if (!preview && composer.content) {
        // Take first 150 characters of content as preview
        preview = composer.content.slice(0, 150);
        if (composer.content.length > 150) {
          preview += '...';
        }
      }

      return {
        id: `composer-${composer.id}`,
        parentId: `${composerKind}-composers`,
        name: composer.title,
        description: `${COMPOSER_KIND_DISPLAY_NAMES[composerKind]}`,
        preview,
        lastUsed: composer.lastAccessedAt || undefined,
        metadata: {
          composerId: composer.id,
          type: COMPOSER_KIND_TO_MENTION_TYPE[composerKind],
          icon: COMPOSER_KIND_ICONS[composerKind],
        },
        // ComposerMentionInstance specific fields
        kind: composerKind,
        title: composer.title,
        content: composer.content || undefined,
        contentSummary: composer.contentSummary || undefined,
        tags: (composer.tags as string[]) || [],
        category: composer.category || undefined,
        viewCount: composer.viewCount || 0,
        editCount: composer.editCount || 0,
        mentionCount: composer.mentionCount || 0,
        lastAccessedAt: composer.lastAccessedAt || undefined,
        createdAt: composer.createdAt,
        userId: composer.userId,
        isContext: composer.isContext || false,
      } as ComposerMentionInstance;
    });
  } catch (error) {
    console.error('Error fetching composers for mention:', error);
    return [];
  }
}

/**
 * Get a single composer by ID for mention context
 */
export async function getComposerForMention(
  composerId: string,
  userId: string,
): Promise<ComposerMentionInstance | null> {
  try {
    const [composer] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, composerId), eq(document.userId, userId)))
      .limit(1);

    if (!composer) {
      return null;
    }

    const composerKind = composer.kind as ComposerKind;
    let preview = composer.contentSummary || '';
    if (!preview && composer.content) {
      preview = composer.content.slice(0, 150);
      if (composer.content.length > 150) {
        preview += '...';
      }
    }

    return {
      id: `composer-${composer.id}`,
      parentId: `${composerKind}-composers`,
      name: composer.title,
      description: `${COMPOSER_KIND_DISPLAY_NAMES[composerKind]}`,
      preview,
      lastUsed: composer.lastAccessedAt || undefined,
      metadata: {
        composerId: composer.id,
        type: COMPOSER_KIND_TO_MENTION_TYPE[composerKind],
        icon: COMPOSER_KIND_ICONS[composerKind],
      },
      kind: composerKind,
      title: composer.title,
      content: composer.content || undefined,
      contentSummary: composer.contentSummary || undefined,
      tags: (composer.tags as string[]) || [],
      category: composer.category || undefined,
      viewCount: composer.viewCount || 0,
      editCount: composer.editCount || 0,
      mentionCount: composer.mentionCount || 0,
      lastAccessedAt: composer.lastAccessedAt || undefined,
      createdAt: composer.createdAt,
      userId: composer.userId,
      isContext: composer.isContext || false,
    } as ComposerMentionInstance;
  } catch (error) {
    console.error('Error getting composer for mention:', error);
    return null;
  }
}

/**
 * Update composer access time when mentioned or opened
 */
export async function trackComposerAccess(
  composerId: string,
  userId: string,
): Promise<void> {
  try {
    await db
      .update(document)
      .set({
        lastAccessedAt: new Date(),
        viewCount: sql`COALESCE(${document.viewCount}, 0) + 1`,
      })
      .where(and(eq(document.id, composerId), eq(document.userId, userId)));
  } catch (error) {
    console.error('Error tracking composer access:', error);
  }
}

/**
 * Increment mention count when a composer is mentioned
 */
export async function incrementComposerMentionCount(
  composerId: string,
): Promise<void> {
  try {
    await db
      .update(document)
      .set({
        mentionCount: sql`COALESCE(${document.mentionCount}, 0) + 1`,
      })
      .where(eq(document.id, composerId));
  } catch (error) {
    console.error('Error incrementing composer mention count:', error);
  }
}
