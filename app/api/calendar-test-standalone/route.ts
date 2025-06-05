import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

/**
 * Extremely simplified test handler for calendar API
 */
export async function GET(request: NextRequest) {
  try {
    console.log('STANDALONE Calendar test started');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Host:', request.headers.get('host'));

    // Try constructing an absolute URL directly
    const baseUrl = request.nextUrl.origin;
    const statusUrl = `${baseUrl}/api/calendar/status`;
    console.log('Constructed URL:', statusUrl);

    // Get session first
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('User authenticated:', session.user.id);

    // Attempt direct HTTP fetch with absolute URL
    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Cookie: request.headers.get('cookie') || '',
        },
      });

      console.log('Status response status:', response.status);
      console.log('Status content-type:', response.headers.get('content-type'));

      // If we got HTML, log it
      if (response.headers.get('content-type')?.includes('text/html')) {
        const text = await response.text();
        console.log('Received HTML response:', `${text.substring(0, 500)}...`);
        return NextResponse.json(
          {
            error: 'Received HTML instead of JSON',
            htmlPreview: text.substring(0, 1000),
          },
          { status: 500 },
        );
      }

      // Try to parse as JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const text = await response.text();
        return NextResponse.json(
          {
            error: 'Failed to parse JSON response',
            responseText: text.substring(0, 1000),
          },
          { status: 500 },
        );
      }

      // Return the results
      return NextResponse.json({
        success: true,
        baseUrl,
        constructedUrl: statusUrl,
        statusResponse: data,
      });
    } catch (fetchError) {
      console.error('Fetch failed:', fetchError);
      return NextResponse.json(
        {
          error: 'Fetch error',
          message:
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError),
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Calendar standalone test error:', error);
    return NextResponse.json(
      {
        error: 'Unhandled error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
