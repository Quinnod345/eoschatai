'use client';

import { useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CTASection from '@/components/marketing/cta-section';
import FAQSection from '@/components/marketing/faq-section';
import FeaturesSection from '@/components/marketing/features-section';
import HeroSection from '@/components/marketing/hero-section';
import LandingFooter from '@/components/marketing/landing-footer';
import LandingNavbar from '@/components/marketing/landing-navbar';
import ProductShowcase from '@/components/marketing/product-showcase';
import SocialProof from '@/components/marketing/social-proof';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const darkeningCoefficient = 0.6;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const scrollToShowcase = () => {
      if (window.location.hash !== '#showcase') return;

      const showcaseSection = document.getElementById('showcase');
      if (!showcaseSection) return;

      const navbarOffset = 112;
      const targetTop =
        showcaseSection.getBoundingClientRect().top +
        window.scrollY -
        navbarOffset;

      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    };

    scrollToShowcase();
    window.addEventListener('hashchange', scrollToShowcase);

    return () => window.removeEventListener('hashchange', scrollToShowcase);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    const ctx = gsap.context(() => {
      gsap.from('.features-content', {
        opacity: 0,
        y: 30,
        filter: 'blur(8px)',
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.features-section',
          start: 'top 74%',
          once: true,
        },
      });

      const showcasePanels = gsap.utils.toArray<HTMLElement>('.showcase-panel');
      showcasePanels.forEach((panel) => {
        const animateItems = panel.querySelectorAll('[data-animate-item]');
        gsap.from(animateItems, {
          opacity: 0,
          y: 24,
          filter: 'blur(8px)',
          duration: 0.65,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: panel,
            start: 'top 78%',
            once: true,
          },
        });
      });

      gsap.from('.faq-container', {
        opacity: 0,
        y: 30,
        filter: 'blur(8px)',
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.faq-section',
          start: 'top 76%',
          once: true,
        },
      });
    });

    return () => ctx.revert();
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="relative w-full overflow-x-hidden bg-black">
      <main>
        <HeroSection />
        <SocialProof />
        <FeaturesSection />
        <ProductShowcase />
        <FAQSection />
        <CTASection />
      </main>

      <LandingFooter />
      <LandingNavbar darkeningCoefficient={darkeningCoefficient} />
    </div>
  );
}
