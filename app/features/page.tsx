'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import EntranceAnimation from '@/components/EntranceAnimation';

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-background/95">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="hero-title text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              Features
            </h1>
            <p className="hero-subtitle mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Explore the powerful features that make EOS AI your perfect assistant
            </p>
          </div>
          
          <div className="prose prose-lg mx-auto">
            <p className="text-center text-gray-600 dark:text-gray-300">
              GSAP animations temporarily disabled for build compatibility.
              Features page content will be restored once build issues are resolved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}