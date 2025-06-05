import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Initialize animations that should run on page load
export const initAnimations = () => {
  // Make sure we're on the client side
  if (typeof window === 'undefined') return;

  // Set up parallax effects
  setupParallaxEffects();

  // Setup section animations
  setupSectionAnimations();

  // Setup feature card animations
  setupFeatureAnimations();

  // Setup testimonial animations
  setupTestimonialAnimations();
};

// Parallax effects for decorative elements
const setupParallaxEffects = () => {
  // Apply parallax effect to any element with a data-speed attribute
  gsap.utils.toArray('[data-speed]').forEach((element: any) => {
    const speed = Number.parseFloat(element.getAttribute('data-speed'));

    gsap.to(element, {
      y: (1 - speed) * (ScrollTrigger.maxScroll(window) * 0.2),
      ease: 'none',
      scrollTrigger: {
        trigger: element.parentElement || element,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  });
};

// Animate sections as they enter the viewport
const setupSectionAnimations = () => {
  // Animate sections when they enter the viewport
  gsap.utils.toArray('.section-spacing').forEach((section: any) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse',
      },
    });

    tl.from(section.querySelectorAll('h2, .container > div > h1'), {
      y: 50,
      opacity: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: 'power3.out',
    })
      .from(
        section.querySelectorAll('p'),
        {
          y: 30,
          opacity: 0,
          duration: 0.6,
          stagger: 0.2,
          ease: 'power2.out',
        },
        '-=0.4',
      )
      .from(
        section.querySelectorAll('a, button'),
        {
          y: 20,
          opacity: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: 'power2.out',
        },
        '-=0.3',
      );
  });
};

// Animate feature cards on scroll
const setupFeatureAnimations = () => {
  // Create a staggered reveal effect for feature cards
  gsap.utils.toArray('.eos-card').forEach((card: any, index: number) => {
    gsap.from(card, {
      y: 100,
      opacity: 0,
      duration: 0.8,
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse',
      },
      ease: 'power3.out',
      delay: index * 0.1,
    });
  });
};

// Animate testimonials on scroll
const setupTestimonialAnimations = () => {
  // Create a staggered reveal effect for testimonials
  gsap.utils
    .toArray('.animate-scaleIn')
    .forEach((testimonial: any, index: number) => {
      gsap.from(testimonial, {
        scale: 0.8,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: testimonial,
          start: 'top 80%',
          end: 'bottom 20%',
          toggleActions: 'play none none reverse',
        },
        ease: 'back.out(1.5)',
        delay: index * 0.15,
      });
    });
};

// Hero section special animation
export const animateHero = () => {
  if (typeof window === 'undefined') return;

  const tl = gsap.timeline();

  // Animate the navbar
  tl.from('.navbar-rounded', {
    y: -100,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
  });

  // Animate hero elements
  tl.from(
    '.hero-title',
    {
      y: 50,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    },
    '-=0.5',
  )
    .from(
      '.hero-description',
      {
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
      },
      '-=0.4',
    )
    .from(
      '.hero-buttons',
      {
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
      },
      '-=0.2',
    )
    .from(
      '.hero-image',
      {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
      },
      '-=0.4',
    );
};

// Animation for floating decorative elements
export const animateDecorative = () => {
  if (typeof window === 'undefined') return;

  // Floating animations for decorative elements
  gsap.utils.toArray('.eos-float').forEach((element: any) => {
    gsap.to(element, {
      y: -15,
      duration: 1.5,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });
  });

  // Spin animations
  gsap.utils.toArray('.eos-spin').forEach((element: any) => {
    gsap.to(element, {
      rotation: 360,
      duration: 20,
      ease: 'none',
      repeat: -1,
    });
  });
};
