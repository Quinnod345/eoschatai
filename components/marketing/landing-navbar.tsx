'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import GlassSurface from '@/components/GlassSurface';
import CardNav from '@/components/CardNav';
import { Button } from '@/components/ui/button';

interface LandingNavbarProps {
  darkeningCoefficient?: number;
}

export default function LandingNavbar({ darkeningCoefficient = 0.6 }: LandingNavbarProps) {
  return (
    <header className="fixed top-4 inset-x-0 z-50 px-4 pointer-events-none" role="banner">
      <div className="mx-auto w-full max-w-5xl pointer-events-auto relative">
        {/* Darkening Effect Behind Navbar Glass */}
        <div
          className="absolute inset-0 -m-2 rounded-[52px] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, rgba(0, 0, 0, ${0.25 * darkeningCoefficient}) 0%, rgba(0, 0, 0, ${0.4 * darkeningCoefficient}) 70%, rgba(0, 0, 0, ${0.5 * darkeningCoefficient}) 100%)`,
            filter: 'blur(16px)',
          }}
        />
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={50}
          blur={10}
          displace={5}
          opacity={0.7}
          backgroundOpacity={0.1}
          brightness={100}
          className="w-full min-h-[64px]"
          insetShadowIntensity={0.1}
          style={{ overflow: 'visible' }}
        >
          <div className="-m-2 w-full h-full">
            <CardNav
              logo={
                <Link href="/" className="flex items-center gap-3">
                  <Image
                    src="/images/eos-model-bulb.svg"
                    alt="EOSAI"
                    width={36}
                    height={36}
                    className="brightness-110"
                  />
                  <span className="font-montserrat text-lg font-bold tracking-tight text-white">
                    EOSAI
                  </span>
                </Link>
              }
              items={[
                {
                  label: 'Features',
                  bgImage: '/images/gradient-blue-orange.jpg',
                  textColor: '#fff',
                  links: [
                    {
                      label: 'Document Intelligence',
                      href: '/features#document-intelligence',
                      ariaLabel: 'Document Intelligence & RAG',
                    },
                    {
                      label: 'AI Personas',
                      href: '/features#personas',
                      ariaLabel: 'Custom AI Personas',
                    },
                    {
                      label: 'Voice & Recording',
                      href: '/features#voice',
                      ariaLabel: 'Voice Mode & Recordings',
                    },
                  ],
                },
                {
                  label: 'Solutions',
                  bgImage: '/images/gradient-orange-blue.jpg',
                  textColor: '#fff',
                  links: [
                    {
                      label: 'Deep Research',
                      href: '/solutions#nexus',
                      ariaLabel: 'Nexus Research Engine',
                    },
                    {
                      label: 'Composer Studio',
                      href: '/solutions#composer',
                      ariaLabel: 'Interactive Composer',
                    },
                    {
                      label: 'Team Collaboration',
                      href: '/solutions#collaboration',
                      ariaLabel: 'Team Hub',
                    },
                  ],
                },
                {
                  label: 'Resources',
                  bgImage: '/images/gradient-blue-red.jpg',
                  textColor: '#fff',
                  links: [
                    {
                      label: 'API Documentation',
                      href: '/docs',
                      ariaLabel: 'API Documentation',
                    },
                    {
                      label: 'All Features',
                      href: '/features',
                      ariaLabel: 'View All Features',
                    },
                    {
                      label: 'Privacy Policy',
                      href: '/privacy',
                      ariaLabel: 'Privacy Policy',
                    },
                    {
                      label: 'Terms of Service',
                      href: '/terms',
                      ariaLabel: 'Terms of Service',
                    },
                  ],
                },
              ]}
              ctaButton={
                <>
                  <Link href="/login">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-montserrat text-white border-white/40 bg-white/10 hover:bg-white/20 hover:border-white/60 backdrop-blur-sm transition-all duration-200"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button
                      size="sm"
                      className="font-montserrat bg-eos-orange hover:bg-eos-orange/90 text-white shadow-[0_4px_16px_rgba(255,121,0,0.3)] hover:shadow-[0_6px_20px_rgba(255,121,0,0.4)] transition-all duration-200"
                    >
                      Get Started
                    </Button>
                  </Link>
                </>
              }
              className="w-full"
            />
          </div>
        </GlassSurface>
      </div>
    </header>
  );
}
