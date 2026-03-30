'use client';

import { LayoutGroup, motion } from 'motion/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  LazyGradientBlinds as GradientBlinds,
  LazyRotatingText as RotatingText,
} from '@/components/marketing/lazy-marketing';

export default function HeroSection() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden flex items-center justify-center pt-32 pb-20">
      <div className="absolute inset-0 z-0">
        <GradientBlinds
          gradientColors={[
            '#0B3E60',
            '#0B3E60',
            '#0B3E60',
            '#1B9066',
            '#FF7900',
            '#FF7900',
            '#FF7900',
          ]}
          angle={28}
          noise={0.4}
          blindCount={14}
          blindMinWidth={72}
          spotlightRadius={0.65}
          spotlightSoftness={1.1}
          spotlightOpacity={0.75}
          mouseDampening={0.22}
          distortAmount={0}
          shineDirection="left"
          mixBlendMode="lighten"
        />
      </div>

      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(255,121,0,0.08),transparent_55%)]" />

      <style jsx>{`
        .hero-line-1 {
          animation: heroBlurIn 0.9s cubic-bezier(0.33, 1, 0.68, 1) forwards;
        }

        .hero-line-2 {
          opacity: 0;
          animation: heroBlurInStrong 1.1s cubic-bezier(0.33, 1, 0.68, 1) 0.45s
            forwards;
        }

        .hero-subtitle {
          opacity: 0;
          animation: heroFadeUp 0.8s cubic-bezier(0.33, 1, 0.68, 1) 1s forwards;
        }

        .hero-cta {
          opacity: 0;
          animation: heroFadeUp 0.8s cubic-bezier(0.33, 1, 0.68, 1) 1.25s
            forwards;
        }

        @keyframes heroBlurIn {
          0% {
            opacity: 0;
            filter: blur(8px);
            transform: translateY(16px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
          }
        }

        @keyframes heroBlurInStrong {
          0% {
            opacity: 0;
            filter: blur(10px);
            transform: translateY(20px) scale(0.985);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0) scale(1);
          }
        }

        @keyframes heroFadeUp {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <p className="hero-line-1 font-mono text-xs md:text-sm text-white/60 tracking-[0.2em] uppercase mb-8">
            The AI workspace for EOS
          </p>

          <h1 className="hero-line-1 font-montserrat text-3xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight mb-5">
            Your AI Assistant for
          </h1>

          <div className="hero-line-2 mb-10 flex justify-center">
            <LayoutGroup>
              <motion.div
                layout
                className="inline-flex items-center justify-center gap-3 md:gap-4"
                transition={{
                  layout: { type: 'spring', damping: 34, stiffness: 250 },
                }}
              >
                <motion.span
                  layout
                  className="font-montserrat text-4xl md:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-eos-orange via-orange-400 to-eos-orange"
                  transition={{
                    layout: { type: 'spring', damping: 34, stiffness: 250 },
                  }}
                >
                  EOS
                </motion.span>

                <motion.span
                  layout
                  className="font-montserrat text-3xl md:text-5xl lg:text-6xl font-bold text-white"
                  transition={{
                    layout: { type: 'spring', damping: 34, stiffness: 250 },
                  }}
                >
                  <RotatingText
                    texts={[
                      'Implementation',
                      'Leadership',
                      'Growth',
                      'Excellence',
                      'Transformation',
                    ]}
                    staggerFrom="last"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '-110%' }}
                    staggerDuration={0.02}
                    splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
                    transition={{
                      type: 'spring',
                      damping: 34,
                      stiffness: 250,
                    }}
                    rotationInterval={3200}
                  />
                </motion.span>
              </motion.div>
            </LayoutGroup>
          </div>

          <p className="hero-subtitle font-montserrat text-base md:text-xl lg:text-2xl font-light text-white/90 max-w-3xl mx-auto leading-relaxed">
            Master the Six Key Components and achieve Traction faster with one
            intelligent workspace for your team.
          </p>

          <div className="hero-cta mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="font-montserrat font-semibold bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-10 py-6 rounded-full shadow-[0_10px_32px_rgba(255,121,0,0.35)] hover:shadow-[0_14px_40px_rgba(255,121,0,0.45)] transition-all duration-300 w-full sm:w-auto"
              >
                Get Started Free
              </Button>
            </Link>

            <a href="#showcase" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="font-montserrat border-white/20 text-white/90 hover:text-white hover:bg-white/10 hover:border-white/40 bg-white/[0.04] backdrop-blur-sm px-10 py-6 rounded-full w-full sm:w-auto transition-all duration-300"
              >
                See It in Action
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
