import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import CourseActivationClient from '@/components/course-activation-client';

export default async function ActivateCoursePage({
  searchParams,
}: {
  searchParams: Promise<{
    courseId?: string;
    spaceId?: string;
    audience?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();

  // Validate required parameters
  if (!params.courseId) {
    redirect('/chat?error=missing_course_id');
  }

  const courseId = params.courseId;
  const spaceId = params.spaceId || process.env.CIRCLE_SPACE_ID || '';
  const audience = params.audience || 'implementer';

  // Validate audience
  if (audience !== 'implementer' && audience !== 'client') {
    redirect('/chat?error=invalid_audience');
  }

  // Pass session and params to client component
  return (
    <CourseActivationClient
      courseId={courseId}
      spaceId={spaceId}
      audience={audience as 'implementer' | 'client'}
      session={session}
    />
  );
}

