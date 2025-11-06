import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Activate Course API Endpoint
 * Redirects to the course activation confirmation page
 * URL: /api/circle/activate-course?courseId=xxx&spaceId=xxx&audience=implementer|client
 */
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const courseId = searchParams.get('courseId');
    const spaceId = searchParams.get('spaceId') || process.env.CIRCLE_SPACE_ID || '';
    const audience = searchParams.get('audience') || 'implementer';

    // Validate required parameters
    if (!courseId) {
      const errorUrl = new URL('/chat', request.url);
      errorUrl.searchParams.set('error', 'missing_course_id');
      return NextResponse.redirect(errorUrl);
    }

    // Redirect to the activation confirmation page
    const activationUrl = new URL('/activate-course', request.url);
    activationUrl.searchParams.set('courseId', courseId);
    if (spaceId) {
      activationUrl.searchParams.set('spaceId', spaceId);
    }
    activationUrl.searchParams.set('audience', audience);

    console.log(`[Circle Activate] Redirecting to activation page for course ${courseId}`);

    return NextResponse.redirect(activationUrl);
  } catch (error) {
    console.error('[Circle Activate] Unexpected error:', error);
    
    const errorUrl = new URL('/chat', request.url);
    errorUrl.searchParams.set('error', 'activation_failed');
    errorUrl.searchParams.set('errorMessage', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.redirect(errorUrl);
  }
}
