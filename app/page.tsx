'use client';

import { useEffect, useState } from 'react';
import { motion, LayoutGroup, useScroll, useTransform } from 'motion/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import GradientBlinds from '@/components/GradientBlinds';
import GlassSurface from '@/components/GlassSurface';
import RotatingText from '@/components/RotatingText';
import ScrollFloat from '@/components/ScrollFloat';
import CircularText from '@/components/CircularText';
import MagicBento from '@/components/MagicBento';
import CardNav from '@/components/CardNav';
import DotGrid from '@/components/DotGrid';
import Dither from '@/components/Dither';
import LazyVideo from '@/components/LazyVideo';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Darkening coefficient for glass surface backdrop (0 = no darkening, 1 = maximum darkening)
  const darkeningCoefficient = 0.6;

  // Parallax scroll effect - use viewport scroll
  const { scrollY } = useScroll();

  // Background scrolls slower (creates depth) - 0.5x speed
  const backgroundY = useTransform(scrollY, [0, 1000], ['0%', '50%']);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Horizontal scroll animation
  useEffect(() => {
    if (!mounted) return;

    const ctx = gsap.context(() => {
      const horizontalSections = gsap.utils.toArray('.horizontal-section');
      const numSections = horizontalSections.length;

      // Create keyframes with sticky zones at each section
      // This makes each section "hold" during continuous scrolling
      const keyframes: Array<{ xPercent: number }> = [];
      const stickyHoldFrames = 2; // Number of duplicate frames to create stickiness
      const firstSlideStickyFrames = 1; // Less stickiness for the first slide

      for (let i = 0; i < numSections; i++) {
        const xPercent = -100 * i;

        // Add frames approaching the section
        if (i > 0) {
          keyframes.push({ xPercent: xPercent + 10 });
        }

        // Add multiple identical frames at the section position (creates the "sticky" pause)
        // First slide gets fewer frames for less stickiness
        const framesToAdd = i === 0 ? firstSlideStickyFrames : stickyHoldFrames;
        for (let j = 0; j < framesToAdd; j++) {
          keyframes.push({ xPercent });
        }

        // Add frame leaving the section
        if (i < numSections - 1) {
          keyframes.push({ xPercent: xPercent - 10 });
        }
      }

      gsap.to(horizontalSections, {
        keyframes,
        ease: 'none',
        scrollTrigger: {
          trigger: '#horizontal-container',
          pin: true,
          scrub: 1,
          end: () => {
            const container = document.querySelector(
              '#horizontal-container',
            ) as HTMLElement | null;
            // Longer scroll distance to accommodate sticky zones
            return `+=${(container?.offsetWidth || 4000) * 1.5}`;
          },
        },
      });

      // EOS Mastery section entrance animations
      const eosTextEl = document.querySelector('.eos-mastery-text');
      const eosVideoEl = document.querySelector('.eos-mastery-video');
      const eosBgEl = document.querySelector('.eos-mastery-bg');

      if (eosTextEl && eosVideoEl && eosBgEl) {
        // Set initial states
        gsap.set(eosTextEl, {
          opacity: 0,
          x: -50,
          filter: 'blur(10px)',
        });
        gsap.set(eosVideoEl, {
          opacity: 0,
          x: 50,
          filter: 'blur(10px)',
        });

        // Background visibility control - show during horizontal scroll section
        gsap.to(eosBgEl, {
          opacity: 1,
          scrollTrigger: {
            trigger: '#horizontal-container',
            start: 'top bottom',
            end: 'bottom top',
            toggleActions: 'play none none reverse',
            onEnter: () => {
              (eosBgEl as HTMLElement).style.pointerEvents = 'auto';
            },
            onLeave: () => {
              (eosBgEl as HTMLElement).style.pointerEvents = 'none';
            },
            onEnterBack: () => {
              (eosBgEl as HTMLElement).style.pointerEvents = 'auto';
            },
            onLeaveBack: () => {
              (eosBgEl as HTMLElement).style.pointerEvents = 'none';
            },
          },
          duration: 0.5,
          ease: 'power2.inOut',
        });

        // Create entrance animation timeline with much shorter scroll distance
        const eosTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#horizontal-container',
            start: 'top top',
            end: '+=400', // Much shorter distance for faster animation
            scrub: 0.3,
          },
        });

        eosTl
          .to(
            eosTextEl,
            {
              opacity: 1,
              x: 0,
              filter: 'blur(0px)',
              duration: 0.3,
              ease: 'power2.out',
            },
            0,
          )
          .to(
            eosVideoEl,
            {
              opacity: 1,
              x: 0,
              filter: 'blur(0px)',
              duration: 0.3,
              ease: 'power2.out',
            },
            0.1,
          );
      }

      // Learn Anew section animations
      const learnAnewEl = document.querySelector('.learn-anew-content');

      if (learnAnewEl) {
        const heading = learnAnewEl.querySelector('h2');
        const subtitle = learnAnewEl.querySelector('p');
        const cards = learnAnewEl.querySelectorAll('.grid > div');

        // Set initial states
        if (heading) {
          gsap.set(heading, {
            opacity: 0,
            y: 30,
            filter: 'blur(10px)',
          });
        }
        if (subtitle) {
          gsap.set(subtitle, {
            opacity: 0,
            y: 20,
            filter: 'blur(8px)',
          });
        }
        gsap.set(cards, {
          opacity: 0,
          y: 40,
          filter: 'blur(10px)',
        });

        // Create entrance animation timeline
        const learnTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#horizontal-container',
            start: 'top top+=1500', // Start when approaching second slide
            end: '+=600',
            scrub: 0.5,
          },
        });

        learnTl
          .to(
            heading,
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.4,
              ease: 'power2.out',
            },
            0,
          )
          .to(
            subtitle,
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.3,
              ease: 'power2.out',
            },
            0.1,
          )
          .to(
            cards,
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.5,
              stagger: 0.1,
              ease: 'power2.out',
            },
            0.2,
          );
      }

      // EOS Assistant section animations
      const eosAssistantEl = document.querySelector('.eos-assistant-content');

      if (eosAssistantEl) {
        const badge = eosAssistantEl.querySelector(
          '.backdrop-blur-sm.bg-white\\/10',
        );
        const heading = eosAssistantEl.querySelector('h2');
        const subtitle = eosAssistantEl.querySelector('p');
        const cards = eosAssistantEl.querySelectorAll('.grid > div');
        const bottomFeatures = eosAssistantEl.querySelectorAll(
          '.flex.flex-wrap > div',
        );

        // Set initial states
        if (badge) {
          gsap.set(badge, {
            opacity: 0,
            scale: 0.9,
            filter: 'blur(10px)',
          });
        }
        if (heading) {
          gsap.set(heading, {
            opacity: 0,
            y: 30,
            filter: 'blur(10px)',
          });
        }
        if (subtitle) {
          gsap.set(subtitle, {
            opacity: 0,
            y: 20,
            filter: 'blur(8px)',
          });
        }
        gsap.set(cards, {
          opacity: 0,
          y: 40,
          filter: 'blur(10px)',
        });
        gsap.set(bottomFeatures, {
          opacity: 0,
          scale: 0.95,
        });

        // Create entrance animation timeline
        const assistantTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#horizontal-container',
            start: 'top top+=3000', // Start when approaching third slide
            end: '+=600',
            scrub: 0.5,
          },
        });

        assistantTl
          .to(
            badge,
            {
              opacity: 1,
              scale: 1,
              filter: 'blur(0px)',
              duration: 0.3,
              ease: 'power2.out',
            },
            0,
          )
          .to(
            heading,
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.4,
              ease: 'power2.out',
            },
            0.1,
          )
          .to(
            subtitle,
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.3,
              ease: 'power2.out',
            },
            0.15,
          )
          .to(
            cards,
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.5,
              stagger: 0.05,
              ease: 'power2.out',
            },
            0.25,
          )
          .to(
            bottomFeatures,
            {
              opacity: 1,
              scale: 1,
              duration: 0.4,
              stagger: 0.05,
              ease: 'power2.out',
            },
            0.5,
          );
      }

      // FAQ section animations
      const faqSection = document.querySelector('.faq-section');

      if (faqSection) {
        const badge = faqSection.querySelector(
          '.backdrop-blur-sm.bg-white\\/10',
        );
        const heading = faqSection.querySelector('h2');
        const subtitle = faqSection.querySelector('p');
        const faqItems = faqSection.querySelectorAll('details');
        const contactFooter = faqSection.querySelector(
          '.flex.items-center.justify-center.gap-2',
        );

        // Set initial states
        if (badge) {
          gsap.set(badge, {
            opacity: 0,
            scale: 0.9,
            filter: 'blur(10px)',
          });
        }
        if (heading) {
          gsap.set(heading, {
            opacity: 0,
            y: 30,
            filter: 'blur(10px)',
          });
        }
        if (subtitle) {
          gsap.set(subtitle, {
            opacity: 0,
            y: 20,
            filter: 'blur(8px)',
          });
        }
        gsap.set(faqItems, {
          opacity: 0,
          y: 30,
          filter: 'blur(8px)',
        });
        if (contactFooter) {
          gsap.set(contactFooter, {
            opacity: 0,
            y: 20,
          });
        }

        // Create entrance animation timeline
        ScrollTrigger.create({
          trigger: faqSection,
          start: 'top 80%',
          onEnter: () => {
            const tl = gsap.timeline();

            if (badge) {
              tl.to(
                badge,
                {
                  opacity: 1,
                  scale: 1,
                  filter: 'blur(0px)',
                  duration: 0.6,
                  ease: 'power2.out',
                },
                0,
              );
            }

            if (heading) {
              tl.to(
                heading,
                {
                  opacity: 1,
                  y: 0,
                  filter: 'blur(0px)',
                  duration: 0.8,
                  ease: 'power2.out',
                },
                0.1,
              );
            }

            if (subtitle) {
              tl.to(
                subtitle,
                {
                  opacity: 1,
                  y: 0,
                  filter: 'blur(0px)',
                  duration: 0.6,
                  ease: 'power2.out',
                },
                0.2,
              );
            }

            tl.to(
              faqItems,
              {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                duration: 0.7,
                stagger: 0.1,
                ease: 'power2.out',
              },
              0.4,
            );

            if (contactFooter) {
              tl.to(
                contactFooter,
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.6,
                  ease: 'power2.out',
                },
                0.8,
              );
            }
          },
        });
      }

      // FAQ accordion animations with proper closing
      const faqDetails = document.querySelectorAll('.faq-item');

      faqDetails.forEach((details) => {
        const summary = details.querySelector('summary');
        const content = details.querySelector('.faq-answer');

        if (content) {
          // Set initial state - start closed
          gsap.set(content, {
            height: 0,
            opacity: 0,
            overflow: 'hidden',
          });
        }

        if (summary) {
          summary.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default toggle behavior

            const detailsEl = details as HTMLDetailsElement;

            if (!detailsEl.open) {
              // Opening
              detailsEl.open = true;

              if (content) {
                gsap.killTweensOf(content);
                const fullHeight = (content as HTMLElement).scrollHeight;
                gsap.fromTo(
                  content,
                  { height: 0, opacity: 0 },
                  {
                    height: fullHeight,
                    opacity: 1,
                    duration: 0.4,
                    ease: 'power2.out',
                  },
                );
              }
            } else {
              // Closing - animate first, then close
              if (content) {
                gsap.killTweensOf(content);
                gsap.to(content, {
                  height: 0,
                  opacity: 0,
                  duration: 0.3,
                  ease: 'power2.in',
                  onComplete: () => {
                    detailsEl.open = false;
                  },
                });
              }
            }
          });
        }
      });

      // CTA section simple blur-in animation
      const ctaSection = document.querySelector('.cta-section');

      if (ctaSection) {
        const heading = ctaSection.querySelector('.cta-heading');
        const description = ctaSection.querySelector('.cta-description');
        const buttonsContainer = ctaSection.querySelector('.cta-buttons');
        const features = ctaSection.querySelectorAll('.flex.flex-wrap > div');

        // Set initial states
        gsap.set([heading, description, buttonsContainer, features], {
          opacity: 0,
          filter: 'blur(10px)',
          y: 20,
        });

        // Create scroll trigger for blur-in effect
        ScrollTrigger.create({
          trigger: ctaSection,
          start: 'top 75%',
          onEnter: () => {
            gsap.to(heading, {
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              duration: 0.8,
              ease: 'power2.out',
            });

            gsap.to(description, {
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              duration: 0.8,
              delay: 0.1,
              ease: 'power2.out',
            });

            gsap.to(buttonsContainer, {
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              duration: 0.8,
              delay: 0.2,
              ease: 'power2.out',
            });

            gsap.to(features, {
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              duration: 0.6,
              stagger: 0.05,
              delay: 0.3,
              ease: 'power2.out',
            });
          },
        });
      }
    });

    return () => ctx.revert();
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="relative w-full bg-black overflow-x-hidden">
      <div className="relative" style={{ minHeight: '200vh' }}>
        {/* Parallax Background Layer */}
        <motion.div
          className="fixed z-0 pointer-events-auto"
          style={{
            width: '100%',
            height: '150vh',
            top: '-25vh',
            left: 0,
            right: 0,
            y: backgroundY,
          }}
        >
          <div className="w-full h-full relative pointer-events-auto">
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
              angle={31}
              noise={0.5}
              blindCount={16}
              blindMinWidth={60}
              spotlightRadius={0.7}
              spotlightSoftness={1}
              spotlightOpacity={0.9}
              mouseDampening={0.25}
              distortAmount={0}
              shineDirection="left"
              mixBlendMode="lighten"
            />
          </div>
        </motion.div>

        {/* Hero Section */}
        <section className="relative z-20 h-screen flex items-center justify-center pointer-events-none">
          {/* Circular Text Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
            <div
              className="relative"
              style={{
                filter: 'url(#noise-filter)',
              }}
            >
              <svg className="absolute w-0 h-0">
                <defs>
                  <filter id="noise-filter">
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.9"
                      numOctaves="4"
                      result="noise"
                    />
                    <feComposite
                      in="SourceGraphic"
                      in2="noise"
                      operator="in"
                      result="composite"
                    />
                    <feBlend
                      in="composite"
                      in2="SourceGraphic"
                      mode="overlay"
                    />
                  </filter>
                </defs>
              </svg>
              <CircularText
                text="VISION • PEOPLE • DATA • ISSUES • PROCESS • TRACTION • "
                spinDuration={100}
                onHover="speedUp"
                className="w-[450px] h-[450px] md:w-[600px] md:h-[600px] lg:w-[750px] lg:h-[750px]"
              />
            </div>
          </div>

          {/* Animated Hero Text */}
          <div className="flex flex-col items-center justify-center px-6 text-center pointer-events-none relative z-10">
            {/* Large Shadow Below Title */}
            <div
              className="absolute inset-0 -m-16 pointer-events-none z-0"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.4) 40%, rgba(0, 0, 0, 0.2) 70%, transparent 100%)',
                filter: 'blur(40px)',
                borderRadius: '100%',
              }}
            />

            <div className="relative z-10 px-12 py-16">
              <div className="flex flex-col items-center">
                <style jsx>{`
          .line1 {
            animation: smoothBlurIn 1s cubic-bezier(0.33, 1, 0.68, 1) forwards;
          }
          .line2 {
            opacity: 0;
            animation: smoothBlurInScale 1.2s cubic-bezier(0.33, 1, 0.68, 1) 0.8s forwards;
          }
          .subtitle {
            opacity: 0;
            animation: gentleBlurIn 0.9s cubic-bezier(0.33, 1, 0.68, 1) 1.8s forwards;
          }
          
          @keyframes smoothBlurIn {
            0% {
              opacity: 0;
              filter: blur(12px);
              transform: translateY(30px) scale(0.98);
            }
            60% {
              filter: blur(4px);
            }
            100% {
              opacity: 1;
              filter: blur(0px);
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes smoothBlurInScale {
            0% {
              opacity: 0;
              filter: blur(16px);
              transform: translateY(35px) scale(0.96);
            }
            65% {
              filter: blur(5px);
            }
            100% {
              opacity: 1;
              filter: blur(0px);
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes gentleBlurIn {
            0% {
              opacity: 0;
              filter: blur(10px);
              transform: translateY(20px);
            }
            70% {
              filter: blur(3px);
            }
            100% {
              opacity: 1;
              filter: blur(0px);
              transform: translateY(0);
            }
          }
        `}</style>

                {/* First Line */}
                <div className="mb-6 line1">
                  <h1 className="font-montserrat text-3xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.15)] tracking-tight leading-tight">
                    Your AI Assistant for
                  </h1>
                </div>

                {/* Second Line with Rotating Text - Isolated Layout */}
                <div className="line2 mb-12 flex justify-center">
                  <LayoutGroup>
                    <motion.div
                      layout
                      className="inline-flex items-center justify-center gap-4"
                      transition={{
                        layout: {
                          type: 'spring',
                          damping: 30,
                          stiffness: 400,
                        },
                      }}
                    >
                      <motion.h1
                        layout
                        className="font-montserrat text-4xl md:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-eos-orange via-orange-400 to-eos-orange drop-shadow-[0_4px_32px_rgba(242,99,34,0.8)] tracking-tight leading-tight"
                        style={{
                          textShadow: '0 0 40px rgba(242, 99, 34, 0.5)',
                        }}
                        transition={{
                          layout: {
                            type: 'spring',
                            damping: 30,
                            stiffness: 400,
                          },
                        }}
                      >
                        EOS
                      </motion.h1>
                      <motion.div
                        layout
                        className="font-montserrat text-3xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.2)] tracking-tight leading-tight"
                        transition={{
                          layout: {
                            type: 'spring',
                            damping: 30,
                            stiffness: 400,
                          },
                        }}
                      >
                        <RotatingText
                          texts={[
                            'Implementation',
                            'Leadership',
                            'Growth',
                            'Excellence',
                            'Success',
                            'Transformation',
                          ]}
                          staggerFrom={'last'}
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '-120%' }}
                          staggerDuration={0.025}
                          splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"
                          transition={{
                            type: 'spring',
                            damping: 30,
                            stiffness: 400,
                          }}
                          rotationInterval={3000}
                        />
                      </motion.div>
                    </motion.div>
                  </LayoutGroup>
                </div>

                {/* Subtitle */}
                <div className="max-w-4xl subtitle flex justify-center">
                  <p className="font-montserrat text-base md:text-xl lg:text-2xl font-light text-white/90 drop-shadow-[0_2px_16px_rgba(255,255,255,0.1)] tracking-wide leading-relaxed text-center">
                    Your journey to an AI-powered business starts here
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Title & Bento Combined Section - Vertical Scroll */}
        <section className="relative z-30 min-h-[140vh] bg-gradient-to-b from-zinc-950 via-zinc-900 to-black pointer-events-auto flex flex-col items-center justify-start pt-24 pb-12">
          <style jsx>{`
            .bento-section {
              max-width: 100% !important;
            }
            @media (min-width: 1024px) {
              .bento-section .card-responsive {
                grid-template-columns: repeat(5, 1fr) !important;
                grid-auto-rows: minmax(180px, auto) !important;
              }
              .bento-section .card-responsive > div:nth-child(1) {
                grid-column: 1;
                grid-row: 1;
              }
              .bento-section .card-responsive > div:nth-child(2) {
                grid-column: 2;
                grid-row: 1;
              }
              .bento-section .card-responsive > div:nth-child(3) {
                grid-column: 3;
                grid-row: 1;
              }
              .bento-section .card-responsive > div:nth-child(4) {
                grid-column: 4;
                grid-row: 1;
              }
              .bento-section .card-responsive > div:nth-child(5) {
                grid-column: 5;
                grid-row: 1;
              }
              .bento-section .card-responsive > div:nth-child(6) {
                grid-column: 1 / span 2;
                grid-row: 2;
              }
              .bento-section .card-responsive > div:nth-child(7) {
                grid-column: 3 / span 2;
                grid-row: 2;
              }
              .bento-section .card-responsive > div:nth-child(8) {
                grid-column: 5;
                grid-row: 2;
              }
              .bento-section .card-responsive > div:nth-child(9) {
                grid-column: 1 / span 3;
                grid-row: 3;
              }
            }
          `}</style>
          <div className="container mx-auto px-6 lg:px-8 xl:px-12">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <ScrollFloat
                  animationDuration={1.4}
                  ease="power3.inOut"
                  scrollStart="top bottom-=-10%"
                  scrollEnd="center top+=5%"
                  stagger={0.025}
                  containerClassName="mb-6"
                  textClassName="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white"
                >
                  Experience the Power of AI
                </ScrollFloat>
                <ScrollFloat
                  animationDuration={1.6}
                  ease="power2.inOut"
                  scrollStart="top bottom-=20%"
                  scrollEnd="center top+=10%"
                  stagger={0.06}
                  containerClassName=""
                  textClassName="font-montserrat text-lg md:text-xl text-white/80 max-w-2xl mx-auto"
                  splitBy="words"
                  useBlur={true}
                  blurAmount={10}
                >
                  Transform your EOS implementation with intelligent automation
                  and insights
                </ScrollFloat>
              </div>
              <div className="flex justify-center w-full max-w-[1600px] mx-auto">
                <MagicBento
                  textAutoHide={false}
                  enableStars={false}
                  enableSpotlight={true}
                  enableBorderGlow={true}
                  enableTilt={true}
                  enableMagnetism={true}
                  clickEffect={true}
                  spotlightRadius={350}
                  particleCount={15}
                  glowColor="255, 121, 0"
                  cards={[
                    {
                      color: 'rgba(255, 121, 0, 0.4)',
                      title: 'Document Intelligence & RAG',
                      description:
                        'Transform your EOS documents into an intelligent knowledge base. Upload V/TOs, Scorecards, and process docs for instant AI-powered analysis and insights.',
                      label: 'Enterprise RAG',
                      icon: (
                        <svg
                          className="w-10 h-10 text-eos-orange"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(240, 78, 35, 0.4)',
                      title: 'Custom AI Personas',
                      description:
                        'Create specialized AI assistants tailored to each EOS role. Pre-built personas for Implementers, Integrators, and Visionaries with custom knowledge bases.',
                      label: 'Role-Based AI',
                      icon: (
                        <svg
                          className="w-10 h-10 text-orange-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(13, 123, 180, 0.4)',
                      title: 'Voice Mode & Meeting Recordings',
                      description:
                        'Talk naturally with AI or record your Level 10, quarterly, and one-on-one meetings. Automatic transcription and action item extraction included.',
                      label: 'Voice AI',
                      icon: (
                        <svg
                          className="w-10 h-10 text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(11, 62, 96, 0.5)',
                      title: 'Nexus Deep Research Engine',
                      description:
                        'Access 40+ real-time sources per query. Get market analysis, competitor insights, and industry trends with automatic citation tracking and synthesis.',
                      label: 'Business Plan',
                      icon: (
                        <svg
                          className="w-10 h-10 text-eos-blue"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(255, 121, 0, 0.5)',
                      title: 'Interactive Composer Studio',
                      description:
                        'Create charts, diagrams, code, and documents in real-time. Export to PDF, DOCX, or generate EOS-specific templates like V/TOs and Scorecards.',
                      label: 'Content Studio',
                      icon: (
                        <svg
                          className="w-10 h-10 text-orange-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(240, 78, 35, 0.5)',
                      title: 'Team Collaboration Hub',
                      description:
                        'Unified workspace for your entire organization. Share personas, documents, and conversations with role-based access and Google Calendar integration.',
                      label: 'Enterprise',
                      icon: (
                        <svg
                          className="w-10 h-10 text-eos-orange"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(13, 123, 180, 0.5)',
                      title: 'Smart Analytics Dashboard',
                      description:
                        'Real-time insights into team performance, meeting effectiveness, and EOS implementation progress with AI-powered recommendations.',
                      label: 'Analytics',
                      icon: (
                        <svg
                          className="w-10 h-10 text-blue-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(11, 62, 96, 0.6)',
                      title: 'Email & Calendar Integration',
                      description:
                        'Seamlessly sync with Google Calendar, schedule Level 10 meetings, and receive AI-generated email summaries and action items.',
                      label: 'Integrations',
                      icon: (
                        <svg
                          className="w-10 h-10 text-blue-800"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      ),
                    },
                    {
                      color: 'rgba(240, 78, 35, 0.6)',
                      title: 'EOS Tools Library',
                      description:
                        'Access complete EOS toolkit: V/TO builder, Accountability Chart creator, Scorecard templates, and automated Rock tracking.',
                      label: 'EOS Toolkit',
                      icon: (
                        <svg
                          className="w-10 h-10 text-orange-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                          />
                        </svg>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* DotGrid Background for horizontal section */}
        <div
          className="fixed inset-0 eos-mastery-bg opacity-0"
          style={{ zIndex: 25, pointerEvents: 'none' }}
        >
          {/* Solid background layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 pointer-events-none" />

          {/* DotGrid layer */}
          <div className="absolute inset-0">
            <DotGrid
              dotSize={3}
              gap={25}
              baseColor="#0B3E60"
              activeColor="#FF7900"
              proximity={150}
              shockRadius={300}
              shockStrength={8}
              resistance={800}
              returnDuration={1.8}
              speedTrigger={80}
              className="w-full h-full"
            />
          </div>

          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        </div>

        {/* Horizontal Scroll Container */}
        <div
          id="horizontal-container"
          className="relative z-30 h-screen w-[300vw] flex flex-nowrap overflow-hidden"
          style={{
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        >
          {/* Slide 1: EOS Model & Tools Mastery */}
          <section
            className="horizontal-section w-screen h-screen relative flex items-center justify-center pointer-events-auto"
            style={{ transform: 'translateZ(0)' }}
          >
            <div className="container mx-auto px-8 md:px-16 lg:px-20 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-[1400px] mx-auto">
                {/* Left: Text Content */}
                <div className="eos-mastery-text">
                  <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                    EOS Model & Tools Mastery
                  </h2>
                  <p className="font-montserrat text-lg md:text-xl text-white/90 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    Leverage deep knowledge of the Six Key Components® and
                    official EOS Tools® like V/TO™, Accountability Chart™, and
                    Scorecard.
                  </p>
                </div>

                {/* Right: Video */}
                <div className="eos-mastery-video relative">
                  <div className="rounded-2xl overflow-hidden border border-white/10 drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-black/20">
                    <LazyVideo
                      src="https://0a4naobicmxnlwbm.public.blob.vercel-storage.com/videos/what-is-eos-08HuP8fmZBiDE8KYpFhxIrxnHQT43u.mp4"
                      preload="metadata"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Slide 2: Learn Anew */}
          <section
            className="horizontal-section w-screen h-screen relative flex items-center justify-center pointer-events-auto py-12 overflow-y-auto"
            style={{ transform: 'translateZ(0)' }}
          >
            <div className="container mx-auto px-8 md:px-16 lg:px-20 relative z-10">
              <div className="max-w-[1400px] mx-auto learn-anew-content">
                {/* Header */}
                <div className="flex flex-col items-center mb-12">
                  <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                    Unparalleled Intelligence
                  </h2>
                  <p className="font-montserrat text-xl text-white/80 text-center max-w-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    Have the peace of mind that the EOS AI is making the right
                    decisions for you
                  </p>
                </div>

                {/* Two Large Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Company Context Card */}
                  <GlassSurface
                    width="100%"
                    height="auto"
                    borderRadius={24}
                    blur={10}
                    displace={5}
                    opacity={0.7}
                    backgroundOpacity={0.1}
                    brightness={100}
                    insetShadowIntensity={0.1}
                    className="p-8"
                    useFallback={true}
                  >
                    <div className="w-full flex flex-col">
                      {/* Video */}
                      <div className="rounded-2xl overflow-hidden mb-6 border border-white/10 bg-black/20">
                        <LazyVideo
                          src="https://0a4naobicmxnlwbm.public.blob.vercel-storage.com/videos/company-context-VHbjYvSVvwvlajVrJlrExn7WdjjkKc.mp4"
                          preload="none"
                        />
                      </div>

                      {/* Card Content */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-eos-orange/20 rounded-lg">
                          <svg
                            className="w-5 h-5 text-eos-orange"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-montserrat text-xl font-bold text-white mb-2">
                            Company Context
                          </h3>
                          <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                            Setup your company and its details and get personal
                            results each time you chat with EOS AI
                          </p>
                        </div>
                      </div>
                    </div>
                  </GlassSurface>

                  {/* Document Context Card */}
                  <GlassSurface
                    width="100%"
                    height="auto"
                    borderRadius={24}
                    blur={10}
                    displace={5}
                    opacity={0.7}
                    backgroundOpacity={0.1}
                    brightness={100}
                    insetShadowIntensity={0.1}
                    className="p-8"
                    useFallback={true}
                  >
                    <div className="w-full flex flex-col">
                      {/* Video */}
                      <div className="rounded-2xl overflow-hidden mb-6 border border-white/10 bg-black/20">
                        <LazyVideo
                          src="https://0a4naobicmxnlwbm.public.blob.vercel-storage.com/videos/document-context-HE9zgUsVQjfTahOiFnOGCc5xCubFNa.mp4"
                          preload="none"
                        />
                      </div>

                      {/* Card Content */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-eos-orange/20 rounded-lg">
                          <svg
                            className="w-5 h-5 text-eos-orange"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-montserrat text-xl font-bold text-white mb-2">
                            Document Context
                          </h3>
                          <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                            Upload your EOS documents to use as context for all
                            ai chats to get the most accurate answers possible.
                          </p>
                        </div>
                      </div>
                    </div>
                  </GlassSurface>
                </div>
              </div>
            </div>
          </section>

          {/* Slide 3: Your Assistant for EOS Mastery */}
          <section
            className="horizontal-section w-screen h-screen relative flex items-center justify-center pointer-events-auto py-12 overflow-y-auto"
            style={{ transform: 'translateZ(0)' }}
          >
            <div className="container mx-auto px-8 md:px-16 lg:px-20 relative z-10">
              <div className="max-w-[1400px] mx-auto eos-assistant-content">
                {/* Badge and Header */}
                <div className="flex flex-col items-center mb-10">
                  <div className="backdrop-blur-sm bg-white/10 px-6 py-2 rounded-full border border-white/20 mb-8">
                    <span className="font-montserrat text-sm font-medium text-white flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      Effortless Deployment
                    </span>
                  </div>

                  <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                    Your Assistant for EOS Mastery
                  </h2>
                  <p className="font-montserrat text-xl text-white/80 text-center max-w-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    Streamline your EOS journey and achieve Traction® faster.
                  </p>
                </div>

                {/* Feature Cards Grid - 3 columns, 2 rows */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
                  {/* V/TO™ & Scorecard AI */}
                  <div className="backdrop-blur-md bg-white/10 rounded-3xl border border-white/20 p-5">
                    <div className="p-2.5 bg-eos-orange/20 rounded-xl w-fit mb-3">
                      <svg
                        className="w-6 h-6 text-eos-orange"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-montserrat text-lg font-bold text-white mb-2">
                      V/TO™ & Scorecard AI
                    </h3>
                    <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                      Generate and manage core EOS documents like your V/TO™ and
                      Scorecard with AI-driven assistance.
                    </p>
                  </div>

                  {/* Personalized Learning */}
                  <div className="backdrop-blur-md bg-white/10 rounded-3xl border border-white/20 p-5">
                    <div className="p-2.5 bg-eos-orange/20 rounded-xl w-fit mb-3">
                      <svg
                        className="w-6 h-6 text-eos-orange"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-montserrat text-lg font-bold text-white mb-2">
                      Personalized Learning
                    </h3>
                    <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                      The AI learns from your V/TO™, Accountability Chart™, and
                      other documents to provide tailored support.
                    </p>
                  </div>

                  {/* AI-Driven Data */}
                  <div className="backdrop-blur-md bg-white/10 rounded-3xl border border-white/20 p-5">
                    <div className="p-2.5 bg-eos-orange/20 rounded-xl w-fit mb-3">
                      <svg
                        className="w-6 h-6 text-eos-orange"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-montserrat text-lg font-bold text-white mb-2">
                      AI-Driven Data
                    </h3>
                    <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                      Leverage AI to analyze your Scorecard, identify trends,
                      and gain deeper insights from your EOS data.
                    </p>
                  </div>

                  {/* Enhanced Team Clarity */}
                  <div className="backdrop-blur-md bg-white/10 rounded-3xl border border-white/20 p-5">
                    <div className="p-2.5 bg-eos-orange/20 rounded-xl w-fit mb-3">
                      <svg
                        className="w-6 h-6 text-eos-orange"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-montserrat text-lg font-bold text-white mb-2">
                      Enhanced Team Clarity
                    </h3>
                    <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                      Support your Level 10 Meetings™ and team discussions with
                      instant access to relevant EOS information and context.
                    </p>
                  </div>

                  {/* Instant EOS Knowledge */}
                  <div className="backdrop-blur-md bg-white/10 rounded-3xl border border-white/20 p-5">
                    <div className="p-2.5 bg-eos-orange/20 rounded-xl w-fit mb-3">
                      <svg
                        className="w-6 h-6 text-eos-orange"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-montserrat text-lg font-bold text-white mb-2">
                      Instant EOS Knowledge
                    </h3>
                    <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                      Receive clear, undiluted guidance drawn directly from core
                      EOS principles. Helps your team accurately identify
                      trends, solve issues using the proven EOS Process™, and
                      maintain unwavering focus on your V/TO™ and Rocks.
                    </p>
                  </div>

                  {/* Continuous EOS Improvement */}
                  <div className="backdrop-blur-md bg-white/10 rounded-3xl border border-white/20 p-5">
                    <div className="p-2.5 bg-eos-orange/20 rounded-xl w-fit mb-3">
                      <svg
                        className="w-6 h-6 text-eos-orange"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-montserrat text-lg font-bold text-white mb-2">
                      Continuous EOS Improvement
                    </h3>
                    <p className="font-montserrat text-sm text-white/70 leading-relaxed">
                      Evolve your EOS implementation with ongoing AI learning
                      and support, adapting to your company's growth and
                      changing needs.
                    </p>
                  </div>
                </div>

                {/* Bottom Features Row */}
                <div className="flex flex-wrap justify-center gap-8">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-white/60"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                    <span className="font-montserrat text-sm text-white/70">
                      EOS Expertise On-Demand
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-white/60"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="font-montserrat text-sm text-white/70">
                      Document-Aware AI
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-white/60"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                    <span className="font-montserrat text-sm text-white/70">
                      Scalable EOS Support
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* FAQ Section */}
        <section className="faq-section relative z-40 min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black flex items-center justify-center pointer-events-auto py-32">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex flex-col items-center mb-16">
                <div className="backdrop-blur-sm bg-white/10 px-6 py-2 rounded-full border border-white/20 mb-8">
                  <span className="font-montserrat text-sm font-medium text-white flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Your Queries, Simplified
                  </span>
                </div>

                <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-center">
                  Questions? Answers!
                </h2>
                <p className="font-montserrat text-lg md:text-xl text-white/70 text-center max-w-2xl">
                  Find quick answers to the most common questions about our
                  platform
                </p>
              </div>

              {/* FAQ Items */}
              <div className="space-y-4 mb-12">
                {[
                  {
                    question: 'What is EOS AI?',
                    answer:
                      'EOS AI is your intelligent assistant designed specifically for EOS implementation. It helps you manage your V/TO™, Scorecard, and other EOS tools with AI-powered insights and automation.',
                  },
                  {
                    question: 'How can EOS AI help my business?',
                    answer:
                      'EOS AI streamlines your EOS journey by providing instant access to EOS knowledge, automating document management, analyzing your Scorecard data, and supporting your Level 10 Meetings™ with context-aware assistance.',
                  },
                  {
                    question: 'What EOS tools does EOS AI support?',
                    answer:
                      'EOS AI supports all core EOS Tools® including V/TO™, Accountability Chart™, Scorecard, Rock tracking, Level 10 Meeting™ agendas, and more. It can help you create, manage, and analyze these essential documents.',
                  },
                  {
                    question:
                      'Can I upload my existing EOS documents to EOS AI?',
                    answer:
                      'Yes! You can upload your existing V/TO™, Scorecards, Accountability Charts, and other EOS documents. The AI will learn from these documents to provide personalized, context-aware support tailored to your company.',
                  },
                  {
                    question:
                      'Is EOS AI a replacement for an EOS Implementer®?',
                    answer:
                      'No, EOS AI is designed to complement your EOS Implementer®, not replace them. It serves as a 24/7 assistant that helps you and your team stay on track between sessions, manage your EOS tools, and maintain focus on your V/TO™ and Rocks.',
                  },
                ].map((faq) => (
                  <details
                    key={faq.question}
                    className="faq-item backdrop-blur-md bg-white/10 rounded-2xl border border-white/20 p-6 group"
                  >
                    <summary className="font-montserrat text-base font-semibold text-white cursor-pointer list-none flex items-center justify-between">
                      <span>{faq.question}</span>
                      <svg
                        className="w-5 h-5 text-white/60 transition-transform duration-300 group-open:rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </summary>
                    <div className="faq-answer">
                      <p className="font-montserrat text-sm text-white/70 leading-relaxed mt-4">
                        {faq.answer}
                      </p>
                    </div>
                  </details>
                ))}
              </div>

              {/* Contact Footer */}
              <div className="flex items-center justify-center gap-2 text-white/70">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-montserrat text-sm">
                  Feel free to mail us for any enquiries :{' '}
                  <a
                    href="mailto:quinn@upaway.dev"
                    className="text-eos-orange hover:underline"
                  >
                    quinn@upaway.dev
                  </a>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section - Vertical Scroll Resumes */}
        <section className="cta-section relative z-40 min-h-screen flex items-center justify-center pointer-events-auto overflow-hidden">
          {/* Dither Background */}
          <div className="absolute inset-0 z-0">
            <Dither
              waveColor={[0.04, 0.24, 0.38]}
              disableAnimation={false}
              enableMouseInteraction={true}
              mouseRadius={0.4}
              colorNum={5}
              waveAmplitude={0.4}
              waveFrequency={2.5}
              waveSpeed={0.03}
            />
          </div>

          {/* Dark overlay for readability */}
          <div className="absolute inset-0 z-0 bg-black/60" />

          <div className="container mx-auto px-6 py-32 relative z-10">
            <div className="max-w-5xl mx-auto">
              {/* Main CTA Content */}
              <div className="text-center mb-16">
                <h2 className="cta-heading font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                  Start Your EOS AI Journey&nbsp;Today
                </h2>
                <p className="cta-description font-montserrat text-lg md:text-xl text-white/70 max-w-3xl mx-auto mb-12">
                  Empower your team with AI-driven EOS implementation. Upload
                  your documents, leverage custom personas, and accelerate your
                  path to Traction®.
                </p>

                {/* CTA Buttons */}
                <div className="cta-buttons flex flex-col sm:flex-row gap-5 justify-center items-center mb-8">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="font-montserrat bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white text-base px-10 py-6 rounded-full shadow-[0_8px_32px_rgba(255,121,0,0.3)] hover:shadow-[0_8px_48px_rgba(255,121,0,0.4)] transition-all duration-300 w-full sm:w-auto font-semibold"
                    >
                      Get Started
                    </Button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="font-montserrat border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 text-base px-10 py-6 rounded-full backdrop-blur-sm bg-white/5 w-full sm:w-auto font-semibold transition-all duration-300"
                    >
                      Sign In
                    </Button>
                  </Link>
                </div>

                {/* Feature Highlights */}
                <div className="flex flex-wrap justify-center gap-6 text-white/60 text-sm">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-eos-orange"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-montserrat">
                      No credit card required
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-eos-orange"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-montserrat">Setup in minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-eos-orange"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-montserrat">AI-powered insights</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-40 bg-black pointer-events-auto border-t border-white/10">
          <div className="container mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Image
                    src="/images/eos-model-bulb.svg"
                    alt="EOSAI"
                    width={32}
                    height={32}
                    className="brightness-110"
                  />
                  <span className="font-montserrat text-xl font-bold text-white">
                    EOSAI
                  </span>
                </div>
                <p className="font-montserrat text-sm text-white/60">
                  Your AI-powered assistant for EOS implementation and business
                  growth.
                </p>
              </div>

              <div>
                <h3 className="font-montserrat font-semibold text-white mb-4">
                  Product
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="#features"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="#pricing"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="#docs"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Documentation
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-montserrat font-semibold text-white mb-4">
                  Company
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="#about"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      About
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="#contact"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/privacy-policy"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-montserrat font-semibold text-white mb-4">
                  Connect
                </h3>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="https://twitter.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Twitter
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://linkedin.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      LinkedIn
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-montserrat text-sm text-white/60 hover:text-white transition-colors"
                    >
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10">
              <p className="font-montserrat text-sm text-white/40 text-center">
                © {new Date().getFullYear()} EOSAI. All rights reserved.
              </p>
            </div>
          </div>
        </footer>

        {/* Glassmorphism Pill Navbar */}
        <header className="fixed top-4 inset-x-0 z-50 px-4 pointer-events-none">
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
                    <div className="flex items-center gap-3">
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
                    </div>
                  }
                  items={[
                    {
                      label: 'Features',
                      bgImage: '/images/gradient-blue-orange.jpg',
                      textColor: '#fff',
                      links: [
                        {
                          label: 'Document Intelligence',
                          href: '#features',
                          ariaLabel: 'Document Intelligence & RAG',
                        },
                        {
                          label: 'AI Personas',
                          href: '#features',
                          ariaLabel: 'Custom AI Personas',
                        },
                        {
                          label: 'Voice & Recording',
                          href: '#features',
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
                          href: '#features',
                          ariaLabel: 'Nexus Research Engine',
                        },
                        {
                          label: 'Composer Studio',
                          href: '#features',
                          ariaLabel: 'Interactive Composer',
                        },
                        {
                          label: 'Team Collaboration',
                          href: '#features',
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
                          label: 'Pricing',
                          href: '#pricing',
                          ariaLabel: 'View Pricing',
                        },
                        {
                          label: 'About',
                          href: '#about',
                          ariaLabel: 'About Us',
                        },
                        {
                          label: 'Documentation',
                          href: '#docs',
                          ariaLabel: 'Documentation',
                        },
                      ],
                    },
                  ]}
                  ctaButton={
                    <>
                      <Link href="/login">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="font-montserrat text-white hover:bg-white/10"
                        >
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/register">
                        <Button
                          size="sm"
                          className="font-montserrat bg-eos-orange hover:bg-eos-orange/90"
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
      </div>
    </div>
  );
}
