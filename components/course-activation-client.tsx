'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BrainIcon,
  CheckIcon,
  LoaderIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@/components/icons';
import type { Session } from 'next-auth';

interface CourseActivationClientProps {
  courseId: string;
  spaceId: string;
  audience: 'implementer' | 'client';
  session: Session | null;
}

interface CourseDetails {
  name: string;
  description: string;
}

export default function CourseActivationClient({
  courseId,
  spaceId,
  audience,
  session,
}: CourseActivationClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [courseDetails, setCourseDetails] = useState<CourseDetails | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // If not logged in, save state and redirect to login
  useEffect(() => {
    if (!session) {
      // Save the return URL in session storage
      const returnUrl = `/activate-course?courseId=${courseId}&spaceId=${spaceId}&audience=${audience}`;
      sessionStorage.setItem('courseActivationReturn', returnUrl);

      // Redirect to login
      const loginUrl = `/login?callbackUrl=${encodeURIComponent(returnUrl)}`;
      router.push(loginUrl);
    } else {
      // User is logged in, fetch course details
      fetchCourseDetails();
    }
  }, [session, courseId, spaceId, audience, router]);

  const fetchCourseDetails = async () => {
    try {
      setIsLoading(true);

      // Fetch course details from Circle API
      const response = await fetch(
        `/api/circle/course-details?courseId=${courseId}&spaceId=${spaceId}`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch course details');
      }

      const data = await response.json();
      setCourseDetails(data);
      setShowConfirmation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    try {
      setIsActivating(true);

      // Call the activation API
      const response = await fetch(
        `/api/circle/activate-course-system?courseId=${courseId}&spaceId=${spaceId}&audience=${audience}`,
        { method: 'POST' },
      );

      if (!response.ok) {
        const errorData = await response.json();

        if (response.status === 404) {
          setError('course_not_found');
          return;
        }

        throw new Error(errorData.errorMessage || 'Failed to activate course');
      }

      const data = await response.json();

      // Success! Redirect to chat with the persona
      router.push(
        `/chat?personaId=${data.personaId}&courseActivated=true&courseName=${encodeURIComponent(courseDetails?.name || 'Course')}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
      setIsActivating(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-eos-orange mb-4 flex justify-center">
            <LoaderIcon size={48} />
          </div>
          <p className="text-muted-foreground">Loading course details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="bg-card border-2 border-red-500/20 rounded-2xl p-8 text-center">
            <div className="text-red-500 mb-4 flex justify-center">
              <BrainIcon size={64} />
            </div>

            {error === 'course_not_found' ? (
              <>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Course Not Found
                </h2>
                <p className="text-muted-foreground mb-6">
                  This course hasn't been synced to our AI knowledge base yet.
                  Please contact your administrator to sync course ID:{' '}
                  <code className="bg-muted px-2 py-1 rounded">{courseId}</code>
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Activation Error
                </h2>
                <p className="text-muted-foreground mb-6">{error}</p>
              </>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={() => router.push('/chat')} variant="outline">
                Go to Chat
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="bg-eos-orange hover:bg-eos-orange/90"
              >
                Try Again
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Confirmation dialog
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <AnimatePresence>
        {showConfirmation && courseDetails && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="max-w-2xl w-full"
          >
            <div className="bg-card border-2 border-border rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-eos-orange to-eos-orangeLight p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="bg-white/20 backdrop-blur-sm rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center"
                >
                  <BrainIcon size={40} className="text-white" />
                </motion.div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Activate Course Assistant
                </h1>
                <p className="text-white/90 text-sm">
                  Add an AI-powered assistant to help with this course
                </p>
              </div>

              {/* Course Details */}
              <div className="p-8">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-foreground">
                      {courseDetails.name}
                    </h2>
                    <Badge className="bg-eos-orange/10 text-eos-orange border-eos-orange/20">
                      {audience === 'implementer'
                        ? 'For Implementers'
                        : 'For Leadership Teams'}
                    </Badge>
                  </div>

                  {courseDetails.description && (
                    <p className="text-muted-foreground leading-relaxed">
                      {courseDetails.description}
                    </p>
                  )}
                </div>

                {/* What You'll Get */}
                <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20 rounded-xl p-6 mb-6">
                  <h3 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
                    <SparklesIcon size={16} />
                    What You'll Get
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <CheckIcon
                        size={16}
                        className="text-green-500 mt-0.5 flex-shrink-0"
                      />
                      <span>
                        AI assistant trained on complete course content
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <CheckIcon
                        size={16}
                        className="text-green-500 mt-0.5 flex-shrink-0"
                      />
                      <span>
                        Personalized instructions generated by GPT-4.1 from
                        course material
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <CheckIcon
                        size={16}
                        className="text-green-500 mt-0.5 flex-shrink-0"
                      />
                      <span>
                        Access to all course lessons, concepts, and frameworks
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <CheckIcon
                        size={16}
                        className="text-green-500 mt-0.5 flex-shrink-0"
                      />
                      <span>
                        Instant answers to your course-related questions
                      </span>
                    </li>
                  </ul>
                </div>

                {/* System Persona Notice */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-blue-600">Note:</strong> This will
                    be added as a system persona. You can use it and remove it
                    from your personas, but you cannot edit the AI instructions
                    (they're optimized for this course).
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => router.push('/chat')}
                    variant="outline"
                    className="flex-1"
                    disabled={isActivating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleActivate}
                    disabled={isActivating}
                    className="flex-1 bg-gradient-to-r from-eos-orange to-eos-orangeLight hover:from-eos-orange/90 hover:to-eos-orangeLight/90 flex items-center justify-center gap-2"
                  >
                    {isActivating ? (
                      <>
                        <LoaderIcon size={16} className="animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <CheckIcon size={16} />
                        Activate Course Assistant
                        <ArrowRightIcon size={16} />
                      </>
                    )}
                  </Button>
                </div>

                {isActivating && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3">
                      <LoaderIcon
                        size={20}
                        className="text-blue-500 animate-spin flex-shrink-0"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-blue-600">
                          Creating your course assistant...
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Generating AI instructions from course content (~5
                          seconds)
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
