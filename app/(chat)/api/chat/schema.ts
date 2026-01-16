import { z } from 'zod/v3';
import { PROVIDERS } from '@/lib/ai/providers';

const textPartSchema = z.object({
  text: z.string().min(1).max(100000),
  type: z.enum(['text']),
});

export /* FIXME(@ai-sdk-upgrade-v5): The `experimental_attachments` property has been replaced with the parts array. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#attachments--file-parts */
const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    createdAt: z.coerce.date(),
    role: z.enum(['user']),
    content: z.string().min(1).max(100000),
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
