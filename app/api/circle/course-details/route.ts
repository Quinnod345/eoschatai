import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchCourseDetails } from '@/lib/integrations/circle';

/**
 * Get Course Details API Endpoint
 * Fetches basic course information from Circle.so for preview
 * GET /api/circle/course-details?courseId=xxx&spaceId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const courseId = searchParams.get('courseId');
    const spaceId = searchParams.get('spaceId') || process.env.CIRCLE_SPACE_ID || '';

    if (!courseId) {
      return NextResponse.json(
        { error: 'Missing required parameter: courseId' },
        { status: 400 },
      );
    }

    if (!spaceId) {
      return NextResponse.json(
        { error: 'Missing spaceId parameter and CIRCLE_SPACE_ID environment variable not set' },
        { status: 400 },
      );
    }

    console.log(`[Course Details] Fetching details for course ${courseId}`);

    // Fetch course details from Circle.so
    const courseDetails = await fetchCourseDetails(spaceId, courseId);

    return NextResponse.json({
      name: courseDetails.name,
      description: courseDetails.description,
    });
  } catch (error) {
    console.error('[Course Details] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch course details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

