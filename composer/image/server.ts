import { openai } from '@ai-sdk/openai';
import { createDocumentHandler } from '@/lib/composer/server';
// AI SDK 5: generateImage renamed to generateImage
import { generateImage, generateId } from 'ai';

export const imageDocumentHandler = createDocumentHandler<'image'>({
  kind: 'image',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    const { image } = await generateImage({
      model: openai.image('dall-e-3'),
      prompt: title,
      n: 1,
    });

    draftContent = image.base64;

    dataStream.write({
      type: 'data-composer',
      id: generateId(),
      data: {
        type: 'image-delta',
        content: image.base64,
      },
    });

    return draftContent;
  },
  onUpdateDocument: async ({ description, dataStream }) => {
    let draftContent = '';

    const { image } = await generateImage({
      model: openai.image('dall-e-3'),
      prompt: description,
      n: 1,
    });

    draftContent = image.base64;

    dataStream.write({
      type: 'data-composer',
      id: generateId(),
      data: {
        type: 'image-delta',
        content: image.base64,
      },
    });

    return draftContent;
  },
});
