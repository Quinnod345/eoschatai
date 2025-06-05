'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function ChatScrollAnimation() {
  const chatContainerRef = useRef(null);

  useGSAP(
    () => {
      // Make sure we're on the client side
      if (typeof window === 'undefined') return;

      // Get chat elements
      const chatWindow = document.querySelector(
        '.relative.z-10.rounded-lg.overflow-hidden.shadow-enhanced',
      );
      const chatMessages = document.querySelectorAll('.flex.items-start.gap-3');

      if (!chatWindow || chatMessages.length === 0) return;

      // Create the animation timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.container',
          pin: chatWindow, // Pin the chat window while active
          start: 'top 15%', // When the top of the trigger hits 15% from the top of viewport
          end: '+=800', // End after scrolling 800px beyond the start
          scrub: 1, // Smooth scrubbing, takes 1 second to "catch up" to the scrollbar
          markers: process.env.NODE_ENV === 'development', // Show markers only in development
          snap: {
            snapTo: 'labels', // Snap to the closest label in the timeline
            duration: { min: 0.2, max: 3 }, // The snap animation duration (based on velocity)
            delay: 0.2, // Wait 0.2 seconds from the last scroll event before snapping
            ease: 'power1.inOut', // The ease of the snap animation
          },
        },
      });

      // Set initial state of messages (hidden)
      gsap.set(chatMessages, { autoAlpha: 0, y: 20 });

      // Add animations and labels to the timeline
      tl.addLabel('start')
        // Animate first message
        .to(chatMessages[0], {
          autoAlpha: 1,
          y: 0,
          duration: 1,
        })
        .addLabel('message1')

        // Animate second message with typing effect
        .to(chatMessages[1], {
          autoAlpha: 1,
          y: 0,
          duration: 1,
        })
        .addLabel('message2')

        // Animate third message
        .to(chatMessages[2], {
          autoAlpha: 1,
          y: 0,
          duration: 1,
        })
        .addLabel('message3')

        // Optional: Add a scale/highlight effect to the entire chat window
        .to(chatWindow, {
          scale: 1.05,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          duration: 1.5,
        })
        .addLabel('highlight')

        // Return to normal
        .to(chatWindow, {
          scale: 1,
          boxShadow: '',
          duration: 1,
        })
        .addLabel('end');

      // Clean up on unmount
      return () => {
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    },
    { scope: chatContainerRef },
  );

  return (
    <div ref={chatContainerRef} className="chat-scroll-animation-container" />
  );
}
