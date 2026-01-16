import { z } from 'zod';

/**
 * Common validation schemas for API routes
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Array with length limits
export const documentIdsSchema = z
  .array(uuidSchema)
  .max(50, 'Maximum 50 documents allowed');

export const shareWithUsersSchema = z
  .array(uuidSchema)
  .max(100, 'Maximum 100 users allowed');

// Memory schemas
export const memoryTypeSchema = z.enum([
  'fact',
  'preference',
  'context',
  'insight',
]);

export const memorySchema = z.object({
  summary: z.string().min(1).max(500, 'Summary must be 500 characters or less'),
  content: z.string().max(10000, 'Content must be 10000 characters or less').optional(),
  topic: z.string().max(100, 'Topic must be 100 characters or less').optional(),
  memoryType: memoryTypeSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Persona schemas
export const personaSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  instructions: z.string().max(10000, 'Instructions must be 10000 characters or less').optional(),
  documentIds: documentIdsSchema.optional(),
  composerDocumentIds: documentIdsSchema.optional(),
  isShared: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
  iconEmoji: z.string().max(10).optional().nullable(),
});

// Document sharing schemas
export const documentShareSchema = z.object({
  documentId: uuidSchema,
  permission: z.enum(['view', 'edit', 'admin']),
  shareWithUsers: shareWithUsersSchema.optional(),
  shareWithOrg: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// Search schemas
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500, 'Query must be 500 characters or less'),
  type: z.enum(['all', 'chats', 'documents', 'recordings', 'messages']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Organization schemas
export const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100, 'Name must be 100 characters or less'),
});

// Research plan schemas
export const researchPlanSchema = z.object({
  query: z.string().min(1).max(1000),
  steps: z.array(z.object({
    type: z.enum(['search', 'analyze', 'synthesize']),
    query: z.string(),
    reasoning: z.string().optional(),
  })).max(10),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Validate request body against a Zod schema
 * Returns the validated data or throws a validation error
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ValidationError(errors.join(', '));
  }
  return result.data;
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Helper to create a JSON response for validation errors
 */
export function validationErrorResponse(error: ValidationError | z.ZodError) {
  const message = error instanceof z.ZodError
    ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    : error.message;
  
  return new Response(
    JSON.stringify({ error: 'Validation failed', details: message }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
