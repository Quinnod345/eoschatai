'use client';

import { useEffect, useRef } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function ChatAnimationContainer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);

  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    // Handle video autoplay
    const currentVideoRef = isMobile ? mobileVideoRef : videoRef;
    if (currentVideoRef.current) {
      currentVideoRef.current.play().catch((err) => {
        console.log('Video autoplay prevented:', err);
      });
    }
  }, [isMobile]);

  if (isMobile) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-[450px] px-4">
          <div className="aspect-square relative rounded-xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800">
            <video
              ref={mobileVideoRef}
              src="/videos/chatexample.mp4"
              className="w-full h-full object-cover object-center transform scale-[1.15]"
              controls
              loop
              muted
              playsInline
              poster="/images/chatexample.png"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-3 mb-4">
            See the EOS AI assistant in action
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Chat Example Section */}
      <div className="relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[80vh] px-4 md:px-8 lg:px-16">
          {/* Text Section */}
          <div className="chat-text-section w-full mx-auto lg:mx-0 max-w-2xl lg:max-w-none relative">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Experience EOS Intelligence
            </h3>
            <div className="space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              <p className="chat-text-reveal text-lg">
                Our AI assistant understands EOS principles and helps you with
                everything from meeting management to strategic planning.
              </p>
              <p className="chat-text-reveal text-lg">
                Get instant insights on your business questions using proven EOS
                methodologies.
              </p>
              <p className="chat-text-reveal text-lg">
                Access your knowledge base and receive personalized guidance
                tailored to your implementation journey.
              </p>
            </div>
          </div>

          {/* Chat Video Container */}
          <div className="chat-video-container w-full max-w-lg mx-auto lg:mx-0 relative">
            <div className="aspect-square relative rounded-xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800">
              <video
                ref={videoRef}
                src="/videos/chatexample.mp4"
                className="w-full h-full object-cover object-center transform scale-[1.15]"
                muted
                playsInline
                poster="/images/chatexample.png"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-3 mb-4">
              See the EOS AI assistant in action
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Text Section */}
      <div className="secondary-text-section relative min-h-[60vh] flex items-center justify-center px-4 md:px-8 lg:px-16">
        <div className="w-full max-w-3xl mx-auto text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Built for EOS Implementers
          </h3>
          <div className="space-y-6 text-gray-600 dark:text-gray-300 leading-relaxed">
            <p className="secondary-text-reveal text-lg">
              Whether you&apos;re preparing for Level 10 meetings or planning your
              next quarterly session, our AI provides expert guidance at every
              step.
            </p>
            <p className="secondary-text-reveal text-lg">
              Access comprehensive EOS resources, track your company's progress,
              and get personalized recommendations for implementation success.
            </p>
          </div>
        </div>
      </div>

      {/* Trigger element for secondary text */}
      <div className="secondary-text-trigger h-1" />
    </div>
  );
}
