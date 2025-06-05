'use client';

import { useRef } from 'react';

export default function ChatScrollAnimation() {
  const chatContainerRef = useRef(null);

  // GSAP animations temporarily disabled for build

  return (
    <div ref={chatContainerRef} className="chat-scroll-animation-container" />
  );
}