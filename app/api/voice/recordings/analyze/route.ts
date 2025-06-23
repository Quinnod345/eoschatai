import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI();

// AssemblyAI for speaker diarization
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;

export const runtime = 'edge';

// GET endpoint for testing
export async function GET() {
  return Response.json({
    status: 'Voice recording analysis API is running',
    assemblyAI: ASSEMBLY_API_KEY ? 'configured' : 'not configured',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return new Response('No file uploaded', { status: 400 });
    }

    console.log(
      `[Speaker Detection] Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`,
    );

    // Test AssemblyAI API key
    if (ASSEMBLY_API_KEY) {
      console.log(
        '[Speaker Detection] AssemblyAI API key found, testing connection...',
      );
      try {
        const testRes = await fetch(
          'https://api.assemblyai.com/v2/transcript',
          {
            method: 'GET',
            headers: { authorization: ASSEMBLY_API_KEY },
          },
        );
        console.log(
          `[Speaker Detection] AssemblyAI API test: ${testRes.status} ${testRes.statusText}`,
        );
      } catch (testErr) {
        console.error(
          '[Speaker Detection] AssemblyAI API test failed:',
          testErr,
        );
      }
    } else {
      console.log(
        '[Speaker Detection] No AssemblyAI API key found in environment',
      );
    }

    // Always transcribe with OpenAI Whisper first
    const transcriptionPromise = openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Speaker diarization with AssemblyAI - prioritize this for better accuracy
    let diarizationResult: any = null;
    let assemblyAIWorked = false;

    if (ASSEMBLY_API_KEY) {
      try {
        console.log(
          '[Speaker Detection] Using AssemblyAI for enhanced speaker detection',
        );

        // Upload file to AssemblyAI
        const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
          method: 'POST',
          headers: {
            authorization: ASSEMBLY_API_KEY,
            'content-type': file.type || 'audio/webm',
          },
          body: file,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          throw new Error(
            `AssemblyAI upload failed: ${uploadRes.status} ${uploadRes.statusText} - ${errorText}`,
          );
        }

        const uploadData = await uploadRes.json();
        console.log(
          '[Speaker Detection] File uploaded to AssemblyAI successfully, URL:',
          uploadData.upload_url,
        );

        // Start transcription with speaker diarization
        const transcriptRes = await fetch(
          'https://api.assemblyai.com/v2/transcript',
          {
            method: 'POST',
            headers: {
              authorization: ASSEMBLY_API_KEY,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              audio_url: uploadData.upload_url,
              speaker_labels: true,
              speakers_expected: null, // Auto-detect number of speakers
              punctuate: true,
              format_text: true,
              // Additional options for better speaker detection
              dual_channel: false, // Set to true if you have stereo audio with speakers on different channels
              speech_model: 'best', // Use the best available model
              language_detection: true, // Auto-detect language
              filter_profanity: false, // Keep original content
              redact_pii: false, // Keep original content
              speed_boost: false, // Prioritize accuracy over speed
            }),
          },
        );

        if (!transcriptRes.ok) {
          const errorText = await transcriptRes.text();
          throw new Error(
            `AssemblyAI transcription request failed: ${transcriptRes.status} ${transcriptRes.statusText} - ${errorText}`,
          );
        }

        const transcriptData = await transcriptRes.json();
        const transcriptId = transcriptData.id;
        console.log(
          `[Speaker Detection] AssemblyAI transcription started with ID: ${transcriptId}`,
        );

        if (!transcriptId) {
          throw new Error('AssemblyAI did not return a transcript ID');
        }

        // Poll for completion with better error handling
        let status = 'processing';
        let pollData: any = null;
        let attempts = 0;
        const maxAttempts = 60; // 3 minutes max
        const pollInterval = 3000; // 3 seconds

        while (
          (status === 'processing' || status === 'queued') &&
          attempts < maxAttempts
        ) {
          await new Promise((r) => setTimeout(r, pollInterval));

          const pollRes = await fetch(
            `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
            {
              headers: { authorization: ASSEMBLY_API_KEY },
            },
          );

          if (!pollRes.ok) {
            console.error(
              `[Speaker Detection] Polling failed: ${pollRes.status} ${pollRes.statusText}`,
            );
            break;
          }

          pollData = await pollRes.json();
          status = pollData.status;
          attempts++;

          console.log(
            `[Speaker Detection] Poll attempt ${attempts}: status = ${status}`,
          );

          if (status === 'error') {
            console.error(
              '[Speaker Detection] AssemblyAI transcription failed:',
              pollData.error,
            );
            break;
          }
        }

        if (
          status === 'completed' &&
          pollData.utterances &&
          pollData.utterances.length > 0
        ) {
          diarizationResult = pollData.utterances;
          assemblyAIWorked = true;
          console.log(
            `[Speaker Detection] AssemblyAI SUCCESS: Found ${pollData.speakers || 'unknown'} speakers with ${pollData.utterances.length} utterances`,
          );
        } else {
          console.log(
            `[Speaker Detection] AssemblyAI failed: status=${status}, utterances=${pollData?.utterances?.length || 0}`,
          );
        }
      } catch (err) {
        console.error('[Speaker Detection] AssemblyAI error:', err);
        // Continue without speaker diarization
      }
    } else {
      console.log(
        '[Speaker Detection] No AssemblyAI API key provided, skipping enhanced speaker detection',
      );
    }

    // Get Whisper transcription
    const transcription = await transcriptionPromise;
    const transcriptData = transcription as any;
    const transcriptText = transcriptData.text as string;

    console.log(
      `[Speaker Detection] Whisper transcription complete: ${transcriptText.length} characters`,
    );

    // Build segments array with improved speaker detection
    let segments: any[] = [];
    let speakerCount = 1;
    let diarizationMethod = 'single-speaker';

    if (assemblyAIWorked && diarizationResult && diarizationResult.length > 0) {
      // Use AssemblyAI's speaker diarization (most accurate)
      console.log('[Speaker Detection] Using AssemblyAI diarization results');
      segments = diarizationResult.map((u: any) => ({
        speaker: (u.speaker as string).charCodeAt(0) - 64, // Convert 'A', 'B', 'C' to 1, 2, 3
        text: u.text.trim(),
        start: u.start / 1000, // AssemblyAI uses milliseconds, convert to seconds
        end: u.end / 1000,
      }));
      speakerCount = [
        ...new Set(segments.map((s: { speaker: number }) => s.speaker)),
      ].length;
      diarizationMethod = 'assemblyai';
    } else if (transcriptData.segments && transcriptData.segments.length > 1) {
      // Enhanced pause-based speaker detection with Whisper segments
      console.log(
        '[Speaker Detection] Using enhanced pause-based speaker detection',
      );

      let currentSpeaker = 1;
      let lastEndTime = 0;
      const pauseThreshold = 1.5; // Reduced from 2.0 seconds for more sensitivity
      const speakerChangeThreshold = 0.8; // Additional threshold for speaker changes

      segments = transcriptData.segments.map((seg: any, idx: number) => {
        const pauseDuration = seg.start - lastEndTime;

        // More sophisticated speaker change detection
        let shouldChangeSpeaker = false;

        if (idx > 0) {
          // Change speaker based on pause duration
          if (pauseDuration > pauseThreshold) {
            shouldChangeSpeaker = true;
          }

          // Also consider text content patterns that might indicate speaker changes
          const prevSegText =
            transcriptData.segments[idx - 1]?.text?.toLowerCase() || '';
          const currentSegText = seg.text?.toLowerCase() || '';

          // Look for conversational patterns
          const questionWords = [
            'what',
            'how',
            'why',
            'when',
            'where',
            'who',
            'can',
            'could',
            'would',
            'should',
          ];
          const responseWords = [
            'yes',
            'no',
            'okay',
            'sure',
            'right',
            'exactly',
            'well',
          ];

          const prevEndsWithQuestion =
            prevSegText.includes('?') ||
            questionWords.some((word) => prevSegText.includes(word));
          const currentStartsWithResponse = responseWords.some((word) =>
            currentSegText.startsWith(word),
          );

          if (
            prevEndsWithQuestion &&
            currentStartsWithResponse &&
            pauseDuration > speakerChangeThreshold
          ) {
            shouldChangeSpeaker = true;
          }
        }

        if (shouldChangeSpeaker) {
          // Cycle through speakers (up to 4 speakers max for fallback method)
          currentSpeaker = currentSpeaker >= 4 ? 1 : currentSpeaker + 1;
        }

        lastEndTime = seg.end;

        return {
          speaker: currentSpeaker,
          text: seg.text.trim(),
          start: seg.start,
          end: seg.end,
        };
      });

      speakerCount = [
        ...new Set(segments.map((s: { speaker: number }) => s.speaker)),
      ].length;
      diarizationMethod = 'enhanced-pause-detection';

      console.log(
        `[Speaker Detection] Enhanced pause detection found ${speakerCount} speakers`,
      );
    } else {
      // Fallback: treat entire transcript as one speaker
      console.log('[Speaker Detection] Using single speaker fallback');
      segments = [
        {
          speaker: 1,
          text: transcriptText,
          start: 0,
          end: transcriptData.duration || 0,
        },
      ];
      speakerCount = 1;
      diarizationMethod = 'single-speaker';
    }

    console.log(
      `[Speaker Detection] Final result: ${speakerCount} speakers using ${diarizationMethod} method`,
    );

    return Response.json({
      id: crypto.randomUUID(),
      transcript: transcriptText,
      segments,
      speakers: speakerCount,
      diarizationMethod,
    });
  } catch (error: any) {
    console.error('Recording analysis error:', error);
    return new Response(`Internal error: ${error.message}`, { status: 500 });
  }
}
