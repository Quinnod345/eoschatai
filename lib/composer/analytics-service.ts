import { db } from '@/lib/db';
import { document, composerMention, chat, message } from '@/lib/db/schema';
import { eq, and, sql, desc, gte, count } from 'drizzle-orm';

/**
 * Composer statistics
 */
export interface ComposerStats {
  composerId: string;
  title: string;
  kind: string;
  viewCount: number;
  editCount: number;
  mentionCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
  recentMentions: Array<{
    chatId: string;
    messageId: string | null;
    mentionedAt: Date;
    context: string | null;
  }>;
}

/**
 * User composer analytics
 */
export interface UserComposerAnalytics {
  totalComposers: number;
  composersByKind: Record<string, number>;
  totalViews: number;
  totalEdits: number;
  totalMentions: number;
  mostViewed: Array<{ id: string; title: string; viewCount: number }>;
  mostEdited: Array<{ id: string; title: string; editCount: number }>;
  mostMentioned: Array<{ id: string; title: string; mentionCount: number }>;
  recentlyAccessed: Array<{ id: string; title: string; lastAccessedAt: Date }>;
}

/**
 * Track when a composer is accessed (viewed/opened)
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
 * Track when a composer is edited
 */
export async function trackComposerEdit(
  composerId: string,
  userId: string,
): Promise<void> {
  try {
    await db
      .update(document)
      .set({
        editCount: sql`COALESCE(${document.editCount}, 0) + 1`,
        lastAccessedAt: new Date(),
      })
      .where(and(eq(document.id, composerId), eq(document.userId, userId)));
  } catch (error) {
    console.error('Error tracking composer edit:', error);
  }
}

/**
 * Track when a composer is mentioned
 */
export async function trackComposerMention(
  composerId: string,
  userId: string,
  chatId?: string,
  messageId?: string,
  context?: string,
): Promise<void> {
  try {
    // Increment mention count on the document
    await db
      .update(document)
      .set({
        mentionCount: sql`COALESCE(${document.mentionCount}, 0) + 1`,
      })
      .where(eq(document.id, composerId));

    // Record the mention details
    await db.insert(composerMention).values({
      composerId,
      userId,
      mentionedInChatId: chatId,
      messageId,
      mentionContext: context?.slice(0, 500), // Limit context length
      mentionedAt: new Date(),
    });
  } catch (error) {
    console.error('Error tracking composer mention:', error);
  }
}

/**
 * Get statistics for a specific composer
 */
export async function getComposerStats(
  composerId: string,
  userId: string,
): Promise<ComposerStats | null> {
  try {
    const [composer] = await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
        viewCount: document.viewCount,
        editCount: document.editCount,
        mentionCount: document.mentionCount,
        lastAccessedAt: document.lastAccessedAt,
        createdAt: document.createdAt,
      })
      .from(document)
      .where(and(eq(document.id, composerId), eq(document.userId, userId)))
      .limit(1);

    if (!composer) {
      return null;
    }

    // Get recent mentions
    const recentMentions = await db
      .select({
        chatId: composerMention.mentionedInChatId,
        messageId: composerMention.messageId,
        mentionedAt: composerMention.mentionedAt,
        context: composerMention.mentionContext,
      })
      .from(composerMention)
      .where(eq(composerMention.composerId, composerId))
      .orderBy(desc(composerMention.mentionedAt))
      .limit(10);

    return {
      composerId: composer.id,
      title: composer.title,
      kind: composer.kind,
      viewCount: composer.viewCount || 0,
      editCount: composer.editCount || 0,
      mentionCount: composer.mentionCount || 0,
      lastAccessedAt: composer.lastAccessedAt,
      createdAt: composer.createdAt,
      recentMentions: recentMentions.map((m: { chatId: string | null; messageId: string | null; mentionedAt: Date; context: string | null }) => ({
        chatId: m.chatId || '',
        messageId: m.messageId,
        mentionedAt: m.mentionedAt,
        context: m.context,
      })),
    };
  } catch (error) {
    console.error('Error getting composer stats:', error);
    return null;
  }
}

/**
 * Get analytics for all of a user's composers
 */
export async function getUserComposerAnalytics(
  userId: string,
): Promise<UserComposerAnalytics> {
  try {
    // Get all composers with stats
    const composers = await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
        viewCount: document.viewCount,
        editCount: document.editCount,
        mentionCount: document.mentionCount,
        lastAccessedAt: document.lastAccessedAt,
      })
      .from(document)
      .where(eq(document.userId, userId));

    // Calculate totals and group by kind
    const composersByKind: Record<string, number> = {};
    let totalViews = 0;
    let totalEdits = 0;
    let totalMentions = 0;

    for (const c of composers) {
      composersByKind[c.kind] = (composersByKind[c.kind] || 0) + 1;
      totalViews += c.viewCount || 0;
      totalEdits += c.editCount || 0;
      totalMentions += c.mentionCount || 0;
    }

    // Get top composers by different metrics
    const mostViewed = [...composers]
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 5)
      .map((c) => ({ id: c.id, title: c.title, viewCount: c.viewCount || 0 }));

    const mostEdited = [...composers]
      .sort((a, b) => (b.editCount || 0) - (a.editCount || 0))
      .slice(0, 5)
      .map((c) => ({ id: c.id, title: c.title, editCount: c.editCount || 0 }));

    const mostMentioned = [...composers]
      .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0))
      .slice(0, 5)
      .map((c) => ({ id: c.id, title: c.title, mentionCount: c.mentionCount || 0 }));

    const recentlyAccessed = [...composers]
      .filter((c) => c.lastAccessedAt)
      .sort(
        (a, b) =>
          (b.lastAccessedAt?.getTime() || 0) - (a.lastAccessedAt?.getTime() || 0),
      )
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.title,
        lastAccessedAt: c.lastAccessedAt!,
      }));

    return {
      totalComposers: composers.length,
      composersByKind,
      totalViews,
      totalEdits,
      totalMentions,
      mostViewed,
      mostEdited,
      mostMentioned,
      recentlyAccessed,
    };
  } catch (error) {
    console.error('Error getting user composer analytics:', error);
    return {
      totalComposers: 0,
      composersByKind: {},
      totalViews: 0,
      totalEdits: 0,
      totalMentions: 0,
      mostViewed: [],
      mostEdited: [],
      mostMentioned: [],
      recentlyAccessed: [],
    };
  }
}

/**
 * Get mention history for a composer
 */
export async function getComposerMentionHistory(
  composerId: string,
  userId: string,
  options?: { limit?: number; since?: Date },
): Promise<
  Array<{
    id: string;
    chatId: string | null;
    chatTitle?: string;
    messageId: string | null;
    mentionedAt: Date;
    context: string | null;
  }>
> {
  const { limit = 50, since } = options || {};

  try {
    let query = db
      .select({
        id: composerMention.id,
        chatId: composerMention.mentionedInChatId,
        messageId: composerMention.messageId,
        mentionedAt: composerMention.mentionedAt,
        context: composerMention.mentionContext,
        chatTitle: chat.title,
      })
      .from(composerMention)
      .leftJoin(chat, eq(composerMention.mentionedInChatId, chat.id))
      .where(
        and(
          eq(composerMention.composerId, composerId),
          eq(composerMention.userId, userId),
          since ? gte(composerMention.mentionedAt, since) : undefined,
        ),
      )
      .orderBy(desc(composerMention.mentionedAt))
      .limit(limit);

    const mentions = await query;

    return mentions.map((m: { id: string; chatId: string | null; chatTitle: string | null; messageId: string | null; mentionedAt: Date; context: string | null }) => ({
      id: m.id,
      chatId: m.chatId,
      chatTitle: m.chatTitle || undefined,
      messageId: m.messageId,
      mentionedAt: m.mentionedAt,
      context: m.context,
    }));
  } catch (error) {
    console.error('Error getting composer mention history:', error);
    return [];
  }
}

/**
 * Batch update access times for multiple composers
 */
export async function batchTrackComposerAccess(
  composerIds: string[],
  userId: string,
): Promise<void> {
  if (composerIds.length === 0) return;

  try {
    // Update all in a single query using SQL
    await db.execute(sql`
      UPDATE "Document"
      SET 
        "lastAccessedAt" = NOW(),
        "viewCount" = COALESCE("viewCount", 0) + 1
      WHERE 
        "id" = ANY(${composerIds})
        AND "userId" = ${userId}
    `);
  } catch (error) {
    console.error('Error batch tracking composer access:', error);
  }
}
