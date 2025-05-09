import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import OpenAI from 'openai';

// Initialize the OpenAI client with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { imageUrl, filename } = data;

    if (!imageUrl) {
      console.error('Image processing: No image URL provided');
      return NextResponse.json(
        { error: 'No image URL provided' },
        { status: 400 },
      );
    }

    console.log(`Processing image: ${filename} from URL: ${imageUrl}`);

    // Process the image using OpenAI's vision model to get OCR text and description
    try {
      // First, get a comprehensive description and any text visible in the image
      const visionResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI trained to analyze images. Your task is to provide a detailed description of the image and extract any visible text.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image. Provide: 1) A comprehensive description of what you see, and 2) Extract any visible text content in the image.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const analysisResult = visionResponse.choices[0]?.message?.content || '';
      console.log(
        `Vision analysis complete. Result length: ${analysisResult.length}`,
      );

      // Use a second prompt to separate the description and extracted text
      const extractionResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI trained to parse image analysis results. Your task is to separate the description from the text content in an analysis.',
          },
          {
            role: 'user',
            content: `Parse the following image analysis result into two distinct parts: 1) Image description, and 2) Extracted text. Format your response as JSON with "description" and "text" fields. If no text was detected, include an empty string for text.\n\nAnalysis result: ${analysisResult}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
      });

      const parsedResult = JSON.parse(
        extractionResponse.choices[0]?.message?.content || '{}',
      );

      return NextResponse.json({
        filename: filename,
        description: parsedResult.description || 'No description available',
        text: parsedResult.text || '',
      });
    } catch (aiError: any) {
      console.error('AI processing error:', aiError);

      // If the Vision API fails, fall back to a simple description
      return NextResponse.json({
        filename: filename,
        description: 'An image was uploaded, but AI processing failed.',
        text: '',
        error: `AI processing failed: ${aiError.message || 'Unknown error'}`,
      });
    }
  } catch (error: any) {
    console.error('Image processing request error:', error);
    return NextResponse.json(
      {
        error: `Server error processing image: ${error.message || 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
}
