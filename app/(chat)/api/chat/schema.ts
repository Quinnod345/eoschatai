import { z } from 'zod/v3';
import { PROVIDERS } from '@/lib/ai/providers';

const textPartSchema = z.object({
  text: z.string().min(1).max(100000),
  type: z.enum(['text']),
});

// AI SDK 5: Message format changed - id is nanoid (not UUID), createdAt optional, content optional (use parts)
export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string(), // SDK 5 uses nanoid format, not UUID
    createdAt: z.coerce.date().optional(), // Optional in SDK 5
    role: z.enum(['user']),
    content: z.string().max(100000).optional(), // Optional in SDK 5 (parts is primary)
    parts: z.array(textPartSchema),
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
  selectedChatModel: z.enum(['chat-model']),
  selectedProvider: z.enum([PROVIDERS.OPENAI]),
  selectedVisibilityType: z.enum(['public', 'private']),
  selectedPersonaId: z.string().optional(),
  selectedProfileId: z.string().optional(),
  selectedResearchMode: z.enum(['off', 'nexus']).optional(),
  composerDocumentId: z.string().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
