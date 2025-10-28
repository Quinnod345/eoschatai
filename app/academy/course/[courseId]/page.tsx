'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { CourseAssistantModal } from '@/components/course-assistant-modal';
import { LoaderIcon } from '@/components/icons';

interface CourseData {
  personaId: string;
  courseName: string;
  courseDescription: string;
  targetAudience: 'implementer' | 'client';
  syncStatus: 'pending' | 'syncing' | 'complete' | 'failed';
  isNewActivation: boolean;
  lastSyncedAt: string | null;
}

export default function CourseActivationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const courseId = params.courseId as string;
  const spaceId = searchParams?.get('spaceId') || '';
  const audience = searchParams?.get('audience') || 'implementer';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setError('Course ID is required');
      setIsLoading(false);
      return;
    }

    activateCourse();
  }, [courseId, spaceId, audience]);

  const activateCourse = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[Course Activation] Activating course:', {
        courseId,
        spaceId,
        audience,
      });

      const url = new URL('/api/circle/activate-course', window.location.origin);
      url.searchParams.set('courseId', courseId);
      if (spaceId) url.searchParams.set('spaceId', spaceId);
      url.searchParams.set('audience', audience);

      const response = await fetch(url.toString());

      if (!response.ok) {
        // If we get a redirect to login, follow it
        if (response.redirected && response.url.includes('/login')) {
          window.location.href = response.url;
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to activate course: ${response.statusText}`,
        );
      }

      const data = await response.json();
      console.log('[Course Activation] Course activated:', data);

      setCourseData(data);
      setIsModalOpen(true);
    } catch (err) {
      console.error('[Course Activation] Error:', err);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    // Navigate to chat or home when modal is closed
    router.push('/chat');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 text-eos-orange animate-spin">
              <LoaderIcon size={48} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-eos-orange to-eos-orangeLight bg-clip-text text-transparent">
              Activating Course Assistant
            </h2>
            <p className="text-muted-foreground">
              Setting up your AI-powered course assistant...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-md mx-auto p-8 bg-background/80 backdrop-blur-sm border border-border rounded-2xl shadow-xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                Activation Failed
              </h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-2 justify-center pt-4">
              <button
                onClick={activateCourse}
                className="px-4 py-2 bg-eos-orange text-white rounded-lg hover:bg-eos-orange/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/chat')}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                Go to Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {courseData && (
        <CourseAssistantModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          courseData={courseData}
        />
      )}
    </div>
  );
}


