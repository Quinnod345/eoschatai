'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import AcademySection from '@/components/marketing/academy-section';
import CTASection from '@/components/marketing/cta-section';
import FAQSection from '@/components/marketing/faq-section';
import FeaturesSection from '@/components/marketing/features-section';
import HeroSection from '@/components/marketing/hero-section';
import LandingFooter from '@/components/marketing/landing-footer';
import LandingNavbar from '@/components/marketing/landing-navbar';
import OrganizationsSection from '@/components/marketing/organizations-section';
import PricingSection from '@/components/marketing/pricing-section';
import ProductShowcase from '@/components/marketing/product-showcase';
import SocialProof from '@/components/marketing/social-proof';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

function SectionDivider() {
  return (
    <div className="relative z-20 py-1">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-4 bg-[radial-gradient(ellipse_at_center,rgba(255,121,0,0.08),transparent_70%)] blur-sm" />
    </div>
  );
}

export default function Home() {
  const darkeningCoefficient = 0.6;
  const gsapInitialized = useRef(false);

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    if (window.location.hash !== '#showcase') {
      window.scrollTo(0, 0);
    }

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

    requestAnimationFrame(() => scrollToShowcase());
    window.addEventListener('hashchange', scrollToShowcase);

    return () => window.removeEventListener('hashchange', scrollToShowcase);
  }, []);

  useEffect(() => {
    if (gsapInitialized.current) return;
    gsapInitialized.current = true;

    const revealDefaults = {
      opacity: 0,
      y: 28,
      filter: 'blur(6px)',
      duration: 0.7,
      ease: 'power2.out',
    };

    const ctx = gsap.context(() => {
      gsap.from('.features-content', {
        ...revealDefaults,
        duration: 0.8,
        scrollTrigger: { trigger: '.features-section', start: 'top 76%', once: true },
      });

      gsap.from('.showcase-header', {
        ...revealDefaults,
        scrollTrigger: { trigger: '#showcase', start: 'top 78%', once: true },
      });

      gsap.from('.showcase-tabs', {
        ...revealDefaults,
        delay: 0.1,
        scrollTrigger: { trigger: '#showcase', start: 'top 78%', once: true },
      });

      gsap.from('.showcase-body', {
        ...revealDefaults,
        delay: 0.2,
        scrollTrigger: { trigger: '#showcase', start: 'top 72%', once: true },
      });

      gsap.from('.academy-header', {
        ...revealDefaults,
        scrollTrigger: { trigger: '.academy-section', start: 'top 78%', once: true },
      });

      gsap.from('.academy-tiers', {
        ...revealDefaults,
        delay: 0.12,
        scrollTrigger: { trigger: '.academy-section', start: 'top 72%', once: true },
      });

      gsap.from('.academy-step', {
        ...revealDefaults,
        stagger: 0.1,
        scrollTrigger: { trigger: '.academy-section', start: 'top 66%', once: true },
      });

      gsap.from('.org-visual', {
        opacity: 0,
        scale: 0.92,
        filter: 'blur(10px)',
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.org-section', start: 'top 74%', once: true },
      });

      gsap.from('.org-content', {
        ...revealDefaults,
        delay: 0.15,
        scrollTrigger: { trigger: '.org-section', start: 'top 74%', once: true },
      });

      gsap.from('.pricing-header', {
        ...revealDefaults,
        scrollTrigger: { trigger: '.pricing-section', start: 'top 78%', once: true },
      });

      gsap.from('.pricing-card', {
        ...revealDefaults,
        stagger: 0.1,
        scrollTrigger: { trigger: '.pricing-section', start: 'top 70%', once: true },
      });

      gsap.from('.faq-container', {
        ...revealDefaults,
        scrollTrigger: { trigger: '.faq-section', start: 'top 76%', once: true },
      });

      gsap.from('.cta-content', {
        ...revealDefaults,
        duration: 0.85,
        scrollTrigger: { trigger: '.cta-section', start: 'top 78%', once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative w-full overflow-x-hidden bg-black">
      <main>
        <HeroSection />
        <SocialProof />

        <SectionDivider />
        <FeaturesSection />

        <SectionDivider />
        <ProductShowcase />

        <SectionDivider />
        <AcademySection />

        <SectionDivider />
        <OrganizationsSection />

        <SectionDivider />
        <PricingSection />

        <SectionDivider />
        <FAQSection />

        <CTASection />
      </main>

      <LandingFooter />
      <LandingNavbar darkeningCoefficient={darkeningCoefficient} />
    </div>
  );
}
