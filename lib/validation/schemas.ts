import { z } from 'zod';

// Common validation patterns
export const emailSchema = z.string().email('Invalid email address').max(255);
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);
export const organizationNameSchema = z.string().min(2).max(100).trim();
export const chatTitleSchema = z.string().min(1).max(200).trim();
export const messageContentSchema = z.string().min(1).max(10000);
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Chat-related schemas
export const createChatSchema = z.object({
  title: chatTitleSchema,
  visibility: z.enum(['private', 'public']),
  personaId: z.string().optional(),
  profileId: z.string().optional(),
});

export const updateChatSchema = z.object({
  title: chatTitleSchema.optional(),
  personaId: z.string().optional(),
  profileId: z.string().optional(),
});

export const sendMessageSchema = z.object({
  content: messageContentSchema,
  chatId: uuidSchema,
  role: z.enum(['user', 'assistant']),
});

// Organization schemas
export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
});

export const inviteUserSchema = z.object({
  email: emailSchema,
  role: z.enum(['member', 'admin']),
});

// User schemas
export const updateUserSettingsSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  companyName: z.string().max(100).optional(),
  companyType: z.string().max(100).optional(),
  companyDescription: z.string().max(500).optional(),
  language: z.string().max(10).optional(),
  fontSize: z.string().max(20).optional(),
  notificationsEnabled: z.boolean().optional(),
});

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Document schemas
export const createDocumentSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(100000),
  kind: z.enum(['text', 'markdown', 'code']),
});

// Search schemas
export const searchSchema = z.object({
  query: z.string().min(1).max(200).trim(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// Rate limiting schemas
export const rateLimitSchema = z.object({
  identifier: z.string().min(1).max(100),
  endpoint: z.string().min(1).max(50),
});

/**
 * Validate request body against a schema
 * @param data Request body data
 * @param schema Zod schema to validate against
 * @returns Validation result with parsed data or error
 */
export function validateRequestBody<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: error 
      };
    }
    return { 
      success: false, 
      error: 'Unknown validation error', 
      details: error as z.ZodError 
    };
  }
}

/**
 * Create a validation error response
 * @param error Validation error details
 * @returns Response object for API routes
 */
export function createValidationErrorResponse(error: z.ZodError) {
  const formattedErrors = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return Response.json(
    {
      error: 'Validation failed',
      details: formattedErrors,
    },
    { status: 400 }
  );
}