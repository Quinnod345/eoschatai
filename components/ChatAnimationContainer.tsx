'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextPlugin } from 'gsap/TextPlugin';
import { SplitText } from 'gsap/SplitText';
import { useMediaQuery } from '../hooks/useMediaQuery';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, TextPlugin, SplitText, useGSAP);

export default function ChatAnimationContainer() {
  // Create references
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);

  // Create context ref to store the gsap context
  const ctxRef = useRef<gsap.Context | null>(null);

  // Detect if mobile - MUST be called every render
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Always call useEffect regardless of mobile or desktop
  useEffect(() => {
    // Skip GSAP initialization for mobile
    if (isMobile) {
      // Simple initialization for mobile video
      if (mobileVideoRef.current) {
        mobileVideoRef.current.play().catch((err) => {
          console.log('Mobile video autoplay prevented:', err);
        });
      }
      return;
    }

    // Create a GSAP context
    const ctx = gsap.context(() => {
      // Hero text animation
      if (document.querySelector('.hero-tagline')) {
        // Create SplitText instances for different elements
        const taglineSplit = new SplitText('.hero-tagline', { type: 'chars' });
        const titleSplit = new SplitText('.hero-title', {
          type: 'chars,words',
        });
        const descriptionSplit = new SplitText('.hero-description', {
          type: 'lines',
        });

        // Get only the "EOS Worldwide" text for color change
        // The HTML structure looks like: "Your AI Assistant for<br>EOS Worldwide"
        // So we need to find the words after the line break
        let eosWorldwideText: Element[];
        // Find the index of the words after the line break
        const brIndex =
          Array.from(document.querySelectorAll('.hero-title br')).length > 0
            ? Array.from(titleSplit.words).findIndex(
                (word) =>
                  word.previousElementSibling &&
                  word.previousElementSibling.tagName === 'BR',
              )
            : -1;

        if (brIndex !== -1) {
          // If we found a BR, get all words after it
          eosWorldwideText = titleSplit.words.slice(brIndex);
        } else {
          // Fallback: just get the last two words which should be "EOS Worldwide"
          eosWorldwideText = titleSplit.words.slice(-2);
        }

        // Create hero animation timeline with a 2-second delay
        const heroTl = gsap.timeline({ delay: 2.3 });

        // Tagline animation
        heroTl.from(taglineSplit.chars, {
          opacity: 0,
          y: 20,
          rotationX: -90,
          stagger: 0.02,
          duration: 0.4,
          ease: 'back.out(1.7)',
        });

        // Title animation - words first appear with a scale effect
        heroTl.from(
          titleSplit.words,
          {
            scale: 0.5,
            opacity: 0,
            duration: 0.3,
            stagger: 0.05,
            ease: 'power1.out',
          },
          '-=0.4',
        );

        // Title animation - characters change color with a staggered effect
        // Only apply to EOS Worldwide text
        heroTl.to(
          eosWorldwideText,
          {
            color: '#ff7e33', // EOS orange
            duration: 0.4,
            stagger: {
              each: 0.03,
              from: 'random',
              grid: 'auto',
            },
            ease: 'power2.inOut',
          },
          '-=0.2',
        );

        // Description animation
        heroTl.from(
          descriptionSplit.lines,
          {
            y: 30,
            opacity: 0,
            stagger: 0.1,
            duration: 0.4,
            ease: 'power2.out',
          },
          '-=0.6',
        );

        // Buttons animation
        heroTl.from(
          '.hero-buttons .eos-button, .hero-buttons .glass-button',
          {
            y: 20,
            opacity: 0,
            stagger: 0.15,
            duration: 0.3,
            ease: 'power1.out',
          },
          '-=0.4',
        );
      }

      // Chat video animations
      // Set initial states for animation elements
      gsap.set('.chat-video-container', { autoAlpha: 1 });

      // Add floating animation for the chat interface
      const floatingTl = gsap.timeline({
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });

      // Subtle floating/hover effect
      floatingTl
        .to('.chat-video-container', {
          y: -15,
          x: 5,
          rotation: 0.5,
          duration: 3,
        })
        .to('.chat-video-container', {
          y: 5,
          x: -5,
          rotation: -0.5,
          duration: 3.5,
        })
        .to('.chat-video-container', {
          y: -5,
          x: 0,
          rotation: 0.3,
          duration: 2.5,
        });

      // Create a timeline for the chat video animation with delayed start
      const chatVideoTl = gsap.timeline({ delay: 2.5 });

      // Fade in the chat video
      chatVideoTl.from('.chat-video', {
        scale: 0.9,
        y: 20,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'power2.out',
        onComplete: () => {
          // Don't autoplay the video - it will be controlled by scroll
          if (videoRef.current) {
            // Set initial frame
            videoRef.current.currentTime = 0;
            videoRef.current.pause();
          }
        },
      });

      // ScrollTrigger for chat container
      ScrollTrigger.create({
        trigger: '#chat-animation-container',
        id: 'chat-pin-animation',
        start: 'top bottom',
        end: 'bottom 80%',
        pin: '.chat-video-container',
        scrub: 0.5,
        onEnter: () => {
          gsap.to(floatingTl, { timeScale: 0.5, duration: 0.8 });
        },
        onLeave: () => {
          gsap.to(floatingTl, { timeScale: 1, duration: 0.8 });
        },
        markers: process.env.NODE_ENV === 'development',
      });

      // Set up initial states
      gsap.set('.chat-text-reveal', { y: 50, autoAlpha: 0 });
      gsap.set('.secondary-text-reveal', { y: 50, autoAlpha: 0 });
      gsap.set('.secondary-text-section', { autoAlpha: 0 });

      // Create a timeline for the first text reveal
      const textRevealTl = gsap.timeline({ paused: true });

      // Add animation to the timeline
      textRevealTl.to('.chat-text-reveal', {
        y: 0,
        autoAlpha: 1,
        stagger: 0.2,
        duration: 0.5,
        ease: 'power2.out',
      });

      // Create a timeline for the secondary text reveal
      const secondaryTextTl = gsap.timeline({ paused: true });

      // Animation for the secondary text reveal - exactly matching the first one
      secondaryTextTl
        .to('.secondary-text-section', { autoAlpha: 1, duration: 0.3 })
        .to(
          '.secondary-text-reveal',
          {
            y: 0,
            autoAlpha: 1,
            stagger: 0.2,
            duration: 0.5,
            ease: 'power2.out',
          },
          '-=0.1',
        );

      // ScrollTrigger for text reveal animation
      ScrollTrigger.create({
        trigger: '.chat-text-section',
        id: 'text-reveal-animation',
        start: 'top 20%',
        end: 'bottom 40%',
        scrub: 0.5,
        pin: '.chat-text-section',
        animation: textRevealTl,
        markers: process.env.NODE_ENV === 'development',
      });

      // Create a timeline for the side movement animation
      const chatSlideTl = gsap.timeline({ paused: true });

      // Create a separate timeline for fading out the first text section
      const firstTextFadeOutTl = gsap.timeline({ paused: true });
      firstTextFadeOutTl.to('.chat-text-section', {
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power2.out',
      });

      // Set initial position
      gsap.set('.chat-video-container', {
        x: 0,
        rotationY: 0,
        rotationX: 0,
        rotationZ: 0,
        transformPerspective: 1000,
      });

      // Animation that will move the chat to the left with dynamic rotation effects
      chatSlideTl
        .to('.chat-video-container', {
          x: '-5vw',
          rotationY: 5, // Start tilting to the right
          rotationX: -2, // Slight downward tilt
          rotationZ: 1, // Slight clockwise rotation
          duration: 0.3,
          ease: 'power2.out',
        })
        .to('.chat-video-container', {
          x: '-40vw',
          rotationY: -8, // Tilt to the left as it moves away
          rotationX: 3, // Tilt upward slightly
          rotationZ: -2, // Counter-clockwise rotation
          duration: 0.7,
          ease: 'power3.inOut',
        })
        .to(
          '.chat-video-container',
          {
            rotationY: 0, // Return to normal rotation
            rotationX: 0,
            rotationZ: 0,
            duration: 0.4,
            ease: 'elastic.out(1, 0.8)', // Elastic snap back for natural feel
          },
          '-=0.1',
        ) // Slightly overlap with previous animation
        .to(
          '.chat-video-container',
          {
            x: '-20vw', // Slide back to the middle
            duration: 0.8,
            ease: 'power2.inOut',
          },
          '+=2', // Add a much longer pause before sliding back
        )
        // Add tilting animations during the slide back, similar to the initial slide
        .to(
          '.chat-video-container',
          {
            rotationY: 5, // Tilt to the right as it starts moving
            rotationX: -2, // Slight downward tilt
            rotationZ: 1, // Slight clockwise rotation
            duration: 0.4,
            ease: 'power2.out',
          },
          '-=0.8',
        ) // Overlap with the start of the slide back
        .to(
          '.chat-video-container',
          {
            rotationY: -5, // Tilt to the left
            rotationX: 2, // Slight upward tilt
            rotationZ: -1, // Counter-clockwise rotation
            duration: 0.5,
            ease: 'power3.inOut',
          },
          '-=0.3',
        ) // Overlap for smooth transition
        .to(
          '.chat-video-container',
          {
            rotationY: 0, // Return to normal rotation
            rotationX: 0,
            rotationZ: 0,
            duration: 0.4,
            ease: 'elastic.out(1, 0.8)', // Elastic snap back for natural feel
          },
          '-=0.2',
        ); // Overlap with previous animation

      // ScrollTrigger for the left movement with increased inertia
      const chatSlideScrollTrigger = ScrollTrigger.create({
        trigger: '.chat-text-section',
        id: 'chat-slide-animation',
        start: 'bottom 40%',
        end: '+=3000', // Extended scroll range even further for the longer delay
        animation: chatSlideTl,
        scrub: 1.5, // Increased scrub value for more inertia
        onEnter: () => {
          floatingTl.pause();
        },
        markers: process.env.NODE_ENV === 'development',
      });

      // Add a callback to the chat slide animation to ensure the secondary text fades at the right time
      ScrollTrigger.create({
        trigger: '.chat-text-section',
        start: 'bottom 40%',
        end: '+=1400', // Adjusted to match the first part of the chat slide animation
        onUpdate: (self) => {
          // When slide to left completes and before the return begins, start fading in the secondary text
          if (self.progress >= 0.3 && self.progress <= 0.6) {
            // Map 0.3-0.6 progress to 0-1 opacity (fade in during the pause)
            const fadeProgress = (self.progress - 0.3) / 0.3;
            gsap.to('.secondary-text-section', {
              autoAlpha: Math.min(fadeProgress, 1),
              duration: 0.1,
            });
          }
        },
        markers: process.env.NODE_ENV === 'development',
      });

      // Separate ScrollTrigger for fading out the secondary text section
      // Using the same chat slide animation trigger, but coordinating the timing to be much later
      ScrollTrigger.create({
        trigger: '.chat-text-section', // Same trigger as the chat slide animation
        id: 'secondary-text-fadeout',
        start: 'bottom 40%', // Same start as the chat slide animation
        end: '+=2750', // Match the full length of the chat slide animation
        onUpdate: (self) => {
          // Only start fading out when we're near the end of the chat slide animation
          // This will happen much later in the scroll sequence
          if (self.progress >= 0.85) {
            // Map 0.85-1.0 progress to 1-0 opacity for fade out
            const fadeOutProgress = 1 - (self.progress - 0.85) / 0.15;
            gsap.to('.secondary-text-section', {
              autoAlpha: Math.max(fadeOutProgress, 0),
              duration: 0.1,
            });
          }
        },
        markers: process.env.NODE_ENV === 'development',
      });

      // Separate ScrollTrigger for fading out the first text section
      ScrollTrigger.create({
        trigger: '.chat-text-section',
        id: 'first-text-fadeout',
        start: 'bottom 40%',
        end: '+=600',
        animation: firstTextFadeOutTl,
        scrub: 0.5,
        markers: process.env.NODE_ENV === 'development',
      });

      // ScrollTrigger for the secondary text reveal - completely independent
      const secondaryTextTrigger = ScrollTrigger.create({
        trigger: '.secondary-text-trigger',
        id: 'secondary-text-animation',
        start: 'top 50%',
        end: 'bottom 10%',
        pin: '.secondary-text-section',
        scrub: 0.5,
        animation: secondaryTextTl,
        toggleActions: 'play none none reverse', // Explicitly set toggle actions
        markers: process.env.NODE_ENV === 'development',
        onLeaveBack: (self) => {
          // Ensure the section is hidden when scrolling back up
          gsap.set('.secondary-text-section', { autoAlpha: 0 });
        },
      });

      // Create ScrollTrigger for video playback right away
      ScrollTrigger.create({
        trigger: '#chat-animation-container',
        start: 'top 90%', // Start a bit earlier to ensure control from beginning
        endTrigger: '.secondary-text-trigger', // Use the same trigger element as the secondary text
        end: 'bottom 10%', // Use the same end position as the secondary text animation
        scrub: 0.5, // Use the same scrub value for consistent timing
        onUpdate: (self) => {
          // Calculate current time based on scroll progress
          if (videoRef.current) {
            const videoDuration = videoRef.current.duration || 0;
            const newTime = self.progress * videoDuration;
            if (!Number.isNaN(newTime) && Number.isFinite(newTime)) {
              videoRef.current.currentTime = newTime;
            }
          }
        },
        markers: process.env.NODE_ENV === 'development',
      });
    });

    // Store the context for cleanup
    ctxRef.current = ctx;

    // Refresh ScrollTrigger to ensure all measurements are correct
    setTimeout(() => {
      ScrollTrigger.refresh();
    }, 300);

    // Cleanup function
    return () => {
      if (ctxRef.current) {
        ctxRef.current.revert(); // Properly revert all GSAP animations
      }

      // Kill all ScrollTriggers to prevent memory leaks
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
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
    <div
      className="w-full h-full flex items-center justify-end -mt-20"
      ref={chatContainerRef}
    >
      <div className="chat-video-container relative w-full h-full">
        {/* Enhanced background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-eos-orange/40 to-eos-navy/30 rounded-3xl blur-3xl opacity-30 animate-pulse" />

        {/* Enhanced shadow for floating effect */}
        <div className="absolute inset-x-[10%] bottom-0 bg-black/20 rounded-full h-4 blur-xl transform translate-y-8" />

        {/* Chat Video Container */}
        <div className="relative z-10 rounded-[24px] overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_50px_rgba(255,255,255,0.05)] bg-white/95 dark:bg-eos-navy/95 backdrop-blur-lg border border-white/40 dark:border-white/10 h-full flex flex-col">
          <video
            ref={videoRef}
            src="/videos/chatexample.mp4"
            className="chat-video object-cover w-full h-full"
            width={600}
            height={800}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
          />
        </div>
      </div>
    </div>
  );
}
