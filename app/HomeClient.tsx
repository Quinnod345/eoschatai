'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import EntranceAnimation from '@/components/EntranceAnimation';

export default function HomeClient() {
  const [showEntrance, setShowEntrance] = useState(true);
  
  // Simple timeout to hide entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowEntrance(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {showEntrance && <EntranceAnimation onAnimationComplete={() => setShowEntrance(false)} />}
      
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="hero-title text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                EOS AI Assistant
              </h1>
              <p className="hero-subtitle mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                Your AI-powered assistant for EOS Worldwide
              </p>
              <div className="hero-buttons mt-8 flex gap-4 justify-center">
                <Button asChild size="lg">
                  <Link href="/chat">Get Started</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/features">Learn More</Link>
                </Button>
              </div>
            </div>
            
            <div className="prose prose-lg mx-auto">
              <p className="text-center text-gray-600 dark:text-gray-300">
                GSAP animations temporarily disabled for build compatibility.
                Full homepage content will be restored once build issues are resolved.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}