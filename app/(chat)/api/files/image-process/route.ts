import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import OpenAI from 'openai';

const createOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      '[image-process] OPENAI_API_KEY missing; skipping AI analysis.',
    );
    return null;
  }

  return new OpenAI({ apiKey });
};

const openai = createOpenAIClient();

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

    // Validate and clean the image URL
    const cleanImageUrl = imageUrl.trim();

    // Check for malformed URLs
    if (cleanImageUrl.endsWith('.') || cleanImageUrl.includes('..')) {
      console.error('Image processing: Malformed URL detected:', cleanImageUrl);
      return NextResponse.json(
        { error: 'Malformed image URL' },
        { status: 400 },
      );
    }

    // Validate URL format
    try {
      new URL(cleanImageUrl);
    } catch (urlError) {
      console.error('Image processing: Invalid URL format:', cleanImageUrl);
      return NextResponse.json(
        { error: 'Invalid image URL format' },
        { status: 400 },
      );
    }

    console.log(`Processing image: ${filename} from URL: ${cleanImageUrl}`);

    if (!openai) {
      return NextResponse.json(
        {
          filename: filename,
          description: 'Image analysis unavailable: OpenAI API key missing.',
          text: '',
        },
        { status: 200 },
      );
    }

    // Process the image using OpenAI's vision model to get OCR text and description
    // Implement retry logic for transient failures
    let lastError: any = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for image processing`);
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)),
          );
        }

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
                    url: cleanImageUrl,
                    detail: 'high', // Request high-detail analysis
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
        });

        const analysisResult =
          visionResponse.choices[0]?.message?.content || '';
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
        lastError = aiError;
        console.error(
          `AI processing error (attempt ${attempt + 1}/${maxRetries + 1}):`,
          {
            message: aiError.message,
            code: aiError.code,
            status: aiError.status,
          },
        );

        // Check if it's a retryable error
        const isRetryable =
          aiError.status === 500 ||
          aiError.status === 503 ||
          aiError.status === 429 ||
          aiError.code === 'ECONNRESET' ||
          aiError.message?.includes('timeout');

        // If not retryable or last attempt, break
        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        // Otherwise continue to next retry
        continue;
      }
    }

    // If all retries failed, return error response
    console.error('All image processing attempts failed:', lastError);
    return NextResponse.json({
      filename: filename,
      description:
        'An image was uploaded, but AI processing failed after retries.',
      text: '',
      error: `AI processing failed: ${lastError?.message || 'Unknown error'}`,
    });
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
