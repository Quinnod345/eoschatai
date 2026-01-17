import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import Anthropic from '@anthropic-ai/sdk';

const createAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      '[image-process] ANTHROPIC_API_KEY missing; skipping AI analysis.',
    );
    return null;
  }

  return new Anthropic({ apiKey });
};

const anthropic = createAnthropicClient();

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

    // If no AI client available, return basic result
    if (!anthropic) {
      console.log('No Anthropic client available, skipping AI analysis');
      return NextResponse.json({
        filename: filename,
        description: 'An image was uploaded',
        text: '',
      });
    }

    // Fetch the image and convert to base64
    let imageBase64: string;
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    
    try {
      const imageResponse = await fetch(cleanImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString('base64');
      
      // Determine media type from URL or content-type
      const contentType = imageResponse.headers.get('content-type') || '';
      if (contentType.includes('png')) {
        mediaType = 'image/png';
      } else if (contentType.includes('gif')) {
        mediaType = 'image/gif';
      } else if (contentType.includes('webp')) {
        mediaType = 'image/webp';
      } else {
        mediaType = 'image/jpeg'; // Default
      }
    } catch (fetchError: any) {
      console.error('Failed to fetch image for processing:', fetchError);
      return NextResponse.json({
        filename: filename,
        description: 'An image was uploaded, but could not be fetched for analysis.',
        text: '',
        error: `Image fetch failed: ${fetchError.message}`,
      });
    }

    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for image processing`);
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)),
          );
        }

        // Get a comprehensive description and any text visible in the image
        const visionResponse = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: imageBase64,
                  },
                },
                {
                  type: 'text',
                  text: 'Analyze this image. Provide: 1) A comprehensive description of what you see, and 2) Extract any visible text content in the image. Format your response as JSON with "description" and "text" fields. If no text is visible, use an empty string for text.',
                },
              ],
            },
          ],
        });

        const analysisResult = visionResponse.content[0].type === 'text' 
          ? visionResponse.content[0].text 
          : '';
        console.log(
          `Vision analysis complete. Result length: ${analysisResult.length}`,
        );

        // Try to parse as JSON, otherwise extract manually
        let parsedResult: { description: string; text: string };
        try {
          // Clean the response - remove markdown code blocks if present
          const cleanedResult = analysisResult
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();
          parsedResult = JSON.parse(cleanedResult);
        } catch {
          // If JSON parsing fails, use the raw analysis as description
          parsedResult = {
            description: analysisResult,
            text: '',
          };
        }

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
          aiError.status === 529 ||
          aiError.code === 'ECONNRESET' ||
          aiError.message?.includes('timeout') ||
          aiError.message?.includes('overloaded');

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
