import { z } from 'zod/v3';
import { PROVIDERS } from '@/lib/ai/providers';

// AI SDK 5 text part
const textPartSchema = z.object({
  text: z.string().min(1).max(100000),
  type: z.literal('text'),
});

// AI SDK 5 file part (URL-based)
const filePartSchema = z.object({
  type: z.literal('file'),
  url: z.string(), // File URL
  mediaType: z.string().default('application/octet-stream'), // Required by UIMessage type
  mimeType: z.string().optional(), // SDK 4 compatibility
});

// Allow any part type (be permissive for SDK 5 flexibility)
const messagePartSchema = z.union([
  textPartSchema,
  filePartSchema,
  // Allow other part types that may be sent
  z.object({
    type: z.string(),
  }).passthrough(),
]);

// AI SDK 5: Message format changed - id is nanoid (not UUID), createdAt optional, content optional (use parts)
export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string(), // SDK 5 uses nanoid format, not UUID
    createdAt: z.coerce.date().optional(), // Optional in SDK 5
    role: z.enum(['user']),
    content: z.string().max(100000).optional(), // Optional in SDK 5 (parts is primary)
    parts: z.array(messagePartSchema),
    experimental_attachments: z
      .array(
        z.object({
          url: z.string().url(),
          name: z.string().min(1).max(2000),
          contentType: z.enum([
            'image/png',
            'image/jpg',
            'image/jpeg',
            'image/gif',
            'image/webp',
            'image/bmp',
            'application/pdf',
            'text/plain', // For the extracted PDF text
          ]),
        }),
      )
      .optional(),
  }),
  selectedChatModel: z.enum(['chat-model', 'claude-sonnet']),
  selectedProvider: z.enum([PROVIDERS.OPENAI, PROVIDERS.ANTHROPIC]),
  selectedVisibilityType: z.enum(['public', 'private']),
  selectedPersonaId: z.string().optional(),
  selectedProfileId: z.string().optional(),
  selectedResearchMode: z.enum(['off', 'nexus']).optional(),
  composerDocumentId: z.string().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
