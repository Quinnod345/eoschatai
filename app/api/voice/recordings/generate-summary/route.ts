import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import OpenAI from 'openai';

const createOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      '[voice.recordings.summary] OPENAI_API_KEY missing; summary generation disabled.',
    );
    return null;
  }

  return new OpenAI({ apiKey });
};

const openai = createOpenAIClient();

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

    if (!openai) {
      return NextResponse.json(
        { summary: 'Summary generation unavailable: OpenAI API key missing.' },
        { status: 200 },
      );
    }

    // Generate summary using GPT-5
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert meeting analyst. Create concise, actionable meeting summaries.',
        },
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
      temperature: 0.7,
    });

    const summary =
      completion.choices[0]?.message?.content || 'Summary generation failed';

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Summary generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 },
    );
  }
}
