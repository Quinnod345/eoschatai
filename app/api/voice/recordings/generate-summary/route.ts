import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import Anthropic from '@anthropic-ai/sdk';

const createAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      '[voice.recordings.summary] ANTHROPIC_API_KEY missing; summary generation disabled.',
    );
    return null;
  }

  return new Anthropic({ apiKey });
};

const anthropic = createAnthropicClient();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transcript, speakers, segments } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript required' },
        { status: 400 },
      );
    }

    // Format transcript with speaker labels for better context
    let formattedTranscript = '';
    if (segments && segments.length > 0) {
      segments.forEach((seg: any) => {
        formattedTranscript += `Speaker ${seg.speaker}: ${seg.text}\n\n`;
      });
    } else {
      formattedTranscript = transcript;
    }

    if (!anthropic) {
      return NextResponse.json(
        { summary: 'Summary generation unavailable: Anthropic API key missing.' },
        { status: 200 },
      );
    }

    // Generate summary using Claude Haiku
    const completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Please analyze this ${speakers}-speaker meeting transcript and provide a comprehensive summary.

Transcript:
${formattedTranscript}

Create a summary that includes:
1. Meeting Overview (2-3 sentences)
2. Key Discussion Points (bullet points)
3. Decisions Made (if any)
4. Action Items (if any)
5. Next Steps (if mentioned)

Keep the summary concise but comprehensive, focusing on the most important information.`,
        },
      ],
      system: 'You are an expert meeting analyst. Create concise, actionable meeting summaries.',
    });

    const summary = completion.content[0].type === 'text' 
      ? completion.content[0].text 
      : 'Unable to generate summary';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[voice.recordings.summary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 },
    );
  }
}
