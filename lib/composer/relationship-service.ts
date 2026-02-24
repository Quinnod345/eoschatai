import { db } from '@/lib/db';
import { document, composerRelationship } from '@/lib/db/schema';
import { eq, and, or, sql, } from 'drizzle-orm';

/**
 * Relationship types between composers
 */
export type RelationshipType =
  | 'parent' // Source is a parent of target
  | 'child' // Source is a child of target
  | 'related' // General relationship
  | 'references' // Source references target
  | 'referenced_by'; // Source is referenced by target

/**
 * A composer relationship with details
 */
export interface ComposerRelation {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceKind: string;
  targetId: string;
  targetTitle: string;
  targetKind: string;
  relationshipType: RelationshipType;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Graph node for visualization
 */
export interface ComposerGraphNode {
  id: string;
  title: string;
  kind: string;
  category?: string;
  tags?: string[];
}

/**
 * Graph edge for visualization
 */
export interface ComposerGraphEdge {
  source: string;
  target: string;
  type: RelationshipType;
}

/**
 * Full composer graph for a user
 */
export interface ComposerGraph {
  nodes: ComposerGraphNode[];
  edges: ComposerGraphEdge[];
}

/**
 * Create a relationship between two composers
 */
export async function createRelationship(
  sourceId: string,
  targetId: string,
  type: RelationshipType,
  userId: string,
  metadata?: Record<string, any>,
): Promise<{ success: boolean; relationshipId?: string; error?: string }> {
  try {
    // Verify both composers belong to the user
    const [source, target] = await Promise.all([
      db
        .select({ id: document.id })
        .from(document)
        .where(and(eq(document.id, sourceId), eq(document.userId, userId)))
        .limit(1),
      db
        .select({ id: document.id })
        .from(document)
        .where(and(eq(document.id, targetId), eq(document.userId, userId)))
        .limit(1),
    ]);

    if (!source[0]) {
      return { success: false, error: 'Source composer not found' };
    }
    if (!target[0]) {
      return { success: false, error: 'Target composer not found' };
    }

    // Check if relationship already exists
    const existing = await db
      .select({ id: composerRelationship.id })
      .from(composerRelationship)
      .where(
        and(
          eq(composerRelationship.sourceId, sourceId),
          eq(composerRelationship.targetId, targetId),
          eq(composerRelationship.relationshipType, type),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return { success: true, relationshipId: existing[0].id };
    }

    // Create the relationship
    const [relationship] = await db
      .insert(composerRelationship)
      .values({
        sourceId,
        targetId,
        relationshipType: type,
        metadata,
        createdAt: new Date(),
      })
      .returning();

    // If creating parent/child, also create inverse
    if (type === 'parent') {
      await db.insert(composerRelationship).values({
        sourceId: targetId,
        targetId: sourceId,
        relationshipType: 'child',
        metadata,
        createdAt: new Date(),
      });
    } else if (type === 'child') {
      await db.insert(composerRelationship).values({
        sourceId: targetId,
        targetId: sourceId,
        relationshipType: 'parent',
        metadata,
        createdAt: new Date(),
      });
    } else if (type === 'references') {
      await db.insert(composerRelationship).values({
        sourceId: targetId,
        targetId: sourceId,
        relationshipType: 'referenced_by',
        metadata,
        createdAt: new Date(),
      });
    }

    return { success: true, relationshipId: relationship.id };
  } catch (error) {
    console.error('Error creating relationship:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a relationship between composers
 */
export async function removeRelationship(
  sourceId: string,
  targetId: string,
  type: RelationshipType,
): Promise<{ success: boolean }> {
  try {
    await db
      .delete(composerRelationship)
      .where(
        and(
          eq(composerRelationship.sourceId, sourceId),
          eq(composerRelationship.targetId, targetId),
          eq(composerRelationship.relationshipType, type),
        ),
      );

    // Remove inverse relationship if applicable
    const inverseType = getInverseType(type);
    if (inverseType) {
      await db
        .delete(composerRelationship)
        .where(
          and(
            eq(composerRelationship.sourceId, targetId),
            eq(composerRelationship.targetId, sourceId),
            eq(composerRelationship.relationshipType, inverseType),
          ),
        );
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing relationship:', error);
    return { success: false };
  }
}

/**
 * Get inverse relationship type
 */
function getInverseType(type: RelationshipType): RelationshipType | null {
  switch (type) {
    case 'parent':
      return 'child';
    case 'child':
      return 'parent';
    case 'references':
      return 'referenced_by';
    case 'referenced_by':
      return 'references';
    default:
      return null;
  }
}

/**
 * Get all related composers for a given composer
 */
export async function getRelatedComposers(
  composerId: string,
  userId: string,
  type?: RelationshipType,
): Promise<ComposerRelation[]> {
  try {
    const sourceDoc = db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
      })
      .from(document)
      .as('sourceDoc');

    const targetDoc = db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
      })
      .from(document)
      .as('targetDoc');

    // Get relationships where this composer is either source or target
    const query = db
      .select({
        id: composerRelationship.id,
        sourceId: composerRelationship.sourceId,
        targetId: composerRelationship.targetId,
        relationshipType: composerRelationship.relationshipType,
        createdAt: composerRelationship.createdAt,
        metadata: composerRelationship.metadata,
      })
      .from(composerRelationship)
      .where(
        and(
          or(
            eq(composerRelationship.sourceId, composerId),
            eq(composerRelationship.targetId, composerId),
          ),
          type ? eq(composerRelationship.relationshipType, type) : undefined,
        ),
      );

    const relationships = await query;

    // Get document details for all related composers
    const relatedIds = new Set<string>();
    for (const rel of relationships) {
      relatedIds.add(rel.sourceId);
      relatedIds.add(rel.targetId);
    }
    relatedIds.delete(composerId);

    const relatedDocs = await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
      })
      .from(document)
      .where(
        and(
          eq(document.userId, userId),
          sql`${document.id} = ANY(${Array.from(relatedIds)})`,
        ),
      );

    type DocRow = { id: string; title: string; kind: string };
    const docsMap = new Map(relatedDocs.map((d: DocRow) => [d.id, d]));

    // Get the source composer details
    const [sourceComposer] = await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
      })
      .from(document)
      .where(eq(document.id, composerId))
      .limit(1);

    type RelRow = { id: string; sourceId: string; targetId: string; relationshipType: string; createdAt: Date; metadata: unknown };
    // Build the result
    const results: ComposerRelation[] = [];
    for (const rel of relationships as RelRow[]) {
      const isSource = rel.sourceId === composerId;
      const otherId = isSource ? rel.targetId : rel.sourceId;
      const otherDoc = docsMap.get(otherId);

      if (!otherDoc || !sourceComposer) continue;

      results.push({
        id: rel.id,
        sourceId: rel.sourceId,
        sourceTitle: isSource ? sourceComposer.title : otherDoc.title,
        sourceKind: isSource ? sourceComposer.kind : otherDoc.kind,
        targetId: rel.targetId,
        targetTitle: isSource ? otherDoc.title : sourceComposer.title,
        targetKind: isSource ? otherDoc.kind : sourceComposer.kind,
        relationshipType: rel.relationshipType as RelationshipType,
        createdAt: rel.createdAt,
        metadata: rel.metadata as Record<string, any> | undefined,
      });
    }
    return results;
  } catch (error) {
    console.error('Error getting related composers:', error);
    return [];
  }
}

/**
 * Get the full composer graph for a user
 */
export async function getComposerGraph(userId: string): Promise<ComposerGraph> {
  try {
    // Get all composers
    const composers = await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
        category: document.category,
        tags: document.tags,
      })
      .from(document)
      .where(eq(document.userId, userId));

    type ComposerGraphRow = { id: string; title: string; kind: string; category: string | null; tags: unknown };
    const composerIds = composers.map((c: ComposerGraphRow) => c.id);

    if (composerIds.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Get all relationships between these composers
    const relationships = await db
      .select({
        sourceId: composerRelationship.sourceId,
        targetId: composerRelationship.targetId,
        relationshipType: composerRelationship.relationshipType,
      })
      .from(composerRelationship)
      .where(
        and(
          sql`${composerRelationship.sourceId} = ANY(${composerIds})`,
          sql`${composerRelationship.targetId} = ANY(${composerIds})`,
        ),
      );

    // Build nodes
    const nodes: ComposerGraphNode[] = composers.map((c: ComposerGraphRow) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      category: c.category || undefined,
      tags: (c.tags as string[]) || undefined,
    }));

    // Build edges (deduplicate bidirectional relationships)
    const seenEdges = new Set<string>();
    const edges: ComposerGraphEdge[] = [];

    for (const rel of relationships) {
      // Create a canonical key for the edge
      const key =
        rel.sourceId < rel.targetId
          ? `${rel.sourceId}-${rel.targetId}-${rel.relationshipType}`
          : `${rel.targetId}-${rel.sourceId}-${rel.relationshipType}`;

      // Skip if already seen (for bidirectional relationships)
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);

      edges.push({
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.relationshipType as RelationshipType,
      });
    }

    return { nodes, edges };
  } catch (error) {
    console.error('Error getting composer graph:', error);
    return { nodes: [], edges: [] };
  }
}

/**
 * Get composers that reference a given composer
 */
export async function getReferencingComposers(
  composerId: string,
  userId: string,
): Promise<Array<{ id: string; title: string; kind: string }>> {
  const relations = await getRelatedComposers(composerId, userId, 'referenced_by');
  return relations.map((r) => ({
    id: r.sourceId,
    title: r.sourceTitle,
    kind: r.sourceKind,
  }));
}

/**
 * Get composers that a given composer references
 */
export async function getReferencedComposers(
  composerId: string,
  userId: string,
): Promise<Array<{ id: string; title: string; kind: string }>> {
  const relations = await getRelatedComposers(composerId, userId, 'references');
  return relations.map((r) => ({
    id: r.targetId,
    title: r.targetTitle,
    kind: r.targetKind,
  }));
}

/**
 * Get parent composers
 */
export async function getParentComposers(
  composerId: string,
  userId: string,
): Promise<Array<{ id: string; title: string; kind: string }>> {
  const relations = await getRelatedComposers(composerId, userId, 'child');
  return relations.map((r) => ({
    id: r.sourceId,
    title: r.sourceTitle,
    kind: r.sourceKind,
  }));
}

/**
 * Get child composers
 */
export async function getChildComposers(
  composerId: string,
  userId: string,
): Promise<Array<{ id: string; title: string; kind: string }>> {
  const relations = await getRelatedComposers(composerId, userId, 'parent');
  return relations.map((r) => ({
    id: r.targetId,
    title: r.targetTitle,
    kind: r.targetKind,
  }));
}

/**
 * Auto-detect references in content and create relationships
 */
export async function autoDetectReferences(
  composerId: string,
  content: string,
  userId: string,
): Promise<{ detectedCount: number; createdCount: number }> {
  try {
    // Get all user's composers to check for title matches
    const allComposers = await db
      .select({
        id: document.id,
        title: document.title,
      })
      .from(document)
      .where(
        and(eq(document.userId, userId), sql`${document.id} != ${composerId}`),
      );

    let detectedCount = 0;
    let createdCount = 0;

    for (const composer of allComposers) {
      // Check if the title is mentioned in the content
      const titlePattern = new RegExp(`\\b${escapeRegex(composer.title)}\\b`, 'i');
      if (titlePattern.test(content)) {
        detectedCount++;

        // Create reference relationship
        const result = await createRelationship(
          composerId,
          composer.id,
          'references',
          userId,
        );

        if (result.success && result.relationshipId) {
          createdCount++;
        }
      }
    }

    return { detectedCount, createdCount };
  } catch (error) {
    console.error('Error auto-detecting references:', error);
    return { detectedCount: 0, createdCount: 0 };
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
