import { auth } from '@/app/(auth)/auth';
import { createCustomProvider, DEFAULT_PROVIDER } from '@/lib/ai/providers';
import { chatModels } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import { saveMessages } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { convertToCoreMessages, streamText } from 'ai';
import { z } from 'zod';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { createDataStream } from 'ai';

export const maxDuration = 60;

const blockSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'code']),
  title: z.string(),
  content: z.string(),
  isVisible: z.boolean().default(false),
  kind: z
    .enum(['text', 'code', 'image', 'video', 'audio'])
    .optional()
    .default('text'),
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  experimental_attachments: z
    .array(
      z.object({
        name: z.string(),
        contentType: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  experimental_providerMetadata: z
    .object({
      anthropic: z
        .object({ cacheControl: z.object({ type: z.string() }) })
        .optional(),
    })
    .optional(),
});

const requestSchema = z.object({
  id: z.string(),
  messages: z.array(messageSchema),
  modelId: z.string(),
  data: z
    .object({
      artifactContext: z
        .object({
          hasActiveArtifact: z.boolean(),
          artifact: z
            .object({
              title: z.string(),
              documentId: z.string(),
              kind: z.string(),
              content: z.string(),
              isVisible: z.boolean(),
              status: z.string(),
            })
            .optional(),
          editIntent: z
            .object({
              type: z.enum(['modify', 'extend', 'improve', 'fix']),
              target: z
                .enum([
                  'specific_section',
                  'entire_content',
                  'conclusion',
                  'introduction',
                ])
                .optional(),
              description: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      shouldEditArtifact: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const { id, messages, modelId, data } = requestSchema.parse(
    await request.json(),
  );

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = chatModels.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = coreMessages[coreMessages.length - 1];

  // Enhanced system prompt with artifact awareness
  let enhancedSystemPrompt = await systemPrompt({
    selectedProvider: DEFAULT_PROVIDER,
    requestHints: {},
    ragContext: [],
    userId: session.user.id,
  });

  // Add artifact context to system prompt if available
  if (data?.artifactContext?.hasActiveArtifact) {
    const { artifact, editIntent } = data.artifactContext;

    enhancedSystemPrompt += `

## ARTIFACT EDITING CONTEXT
You are currently working with an active artifact:
- Type: ${artifact?.kind}
- Title: "${artifact?.title}"
- Content Length: ${artifact?.content?.length || 0} characters

CRITICAL EDITING INSTRUCTIONS:
${
  editIntent
    ? `
The user wants to ${editIntent.type.toUpperCase()} the existing artifact.
${editIntent.target ? `Target: ${editIntent.target.replace('_', ' ')}` : ''}

MANDATORY TOOL USAGE - YOU MUST FOLLOW THIS EXACTLY:
1. You MUST call the updateDocument tool with these exact parameters:
   - id: "${artifact?.documentId}"
   - description: "${userMessage.content}"

2. DO NOT generate any content in your response text
3. DO NOT explain what you're doing 
4. ONLY call the updateDocument tool
5. The tool will handle all content generation and streaming
6. Your response should be empty except for the tool call

IMPORTANT: If you do not call the updateDocument tool, you are failing to follow instructions.
`
    : `
The user is referring to the existing artifact.
- If they want changes, you MUST use the updateDocument tool with ID "${artifact?.documentId}"
- If they ask questions, answer in chat normally
- DO NOT duplicate content from the artifact in your response
`
}

Current artifact content preview:
\`\`\`
${artifact?.content?.substring(0, 500)}${(artifact?.content?.length || 0) > 500 ? '...' : ''}
\`\`\`

ARTIFACT EDITING RULES:
1. When user asks to modify/extend/improve the artifact → MANDATORY: Call updateDocument tool
2. When user asks questions about the artifact → Answer in chat only  
3. When user wants something new → Create new artifact
4. The updateDocument tool will preserve existing content and make targeted changes
5. Do not generate content yourself when editing - let the tool handle it
`;
  }

  // Create a provider based on selected provider
  const provider = createCustomProvider(DEFAULT_PROVIDER);

  // Create data stream for tool responses
  const dataStream = createDataStream({
    execute: async (dataStream) => {
      const result = await streamText({
        model: provider.languageModel(model.id),
        system: enhancedSystemPrompt,
        messages: coreMessages,
        maxSteps: 5,
        experimental_activeTools: [
          'createDocument',
          'updateDocument',
          'requestSuggestions',
          'getWeather',
        ],
        tools: {
          getWeather,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({ session, dataStream }),
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'stream-text',
        },
        onFinish: async ({ response }) => {
          if (session.user?.id) {
            try {
              const assistantId = generateUUID();

              const assistantMessage =
                response.messages[response.messages.length - 1];

              if (assistantMessage && assistantMessage.role === 'assistant') {
                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.content
                        ? [{ type: 'text', text: assistantMessage.content }]
                        : [],
                      attachments: [],
                      createdAt: new Date(),
                      provider: DEFAULT_PROVIDER,
                    },
                  ],
                });
              }
            } catch (error) {
              console.error('Failed to save chat:', error);
            }
          }
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
  });

  return new Response(dataStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
