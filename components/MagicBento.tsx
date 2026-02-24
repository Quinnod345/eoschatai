import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { gsap } from 'gsap';

export interface BentoCardProps {
  color?: string;
  title?: string;
  description?: string;
  label?: string;
  icon?: React.ReactNode;
  textAutoHide?: boolean;
  disableAnimations?: boolean;
}

export interface BentoProps {
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  enableTilt?: boolean;
  glowColor?: string;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
  cards?: BentoCardProps[];
}

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
const DEFAULT_GLOW_COLOR = '242, 99, 34'; // EOS Orange
const MOBILE_BREAKPOINT = 768;

const createParticleElement = (
  x: number,
  y: number,
  color: string = DEFAULT_GLOW_COLOR,
): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = 'particle';
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.6);
    pointer-events: none;
    z-index: 100;
    left: ${x}px;
    top: ${y}px;
  `;
  return el;
};

const calculateSpotlightValues = (radius: number) => ({
  proximity: radius * 0.5,
  fadeDistance: radius * 0.75,
});

const updateCardGlowProperties = (
  card: HTMLElement,
  mouseX: number,
  mouseY: number,
  glow: number,
  radius: number,
) => {
  const rect = card.getBoundingClientRect();
  const relativeX = ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = ((mouseY - rect.top) / rect.height) * 100;

  card.style.setProperty('--glow-x', `${relativeX}%`);
  card.style.setProperty('--glow-y', `${relativeY}%`);
  card.style.setProperty('--glow-intensity', glow.toString());
  card.style.setProperty('--glow-radius', `${radius}px`);
};

const ParticleCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  disableAnimations?: boolean;
  style?: React.CSSProperties;
  particleCount?: number;
  glowColor?: string;
  enableTilt?: boolean;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
}> = ({
  children,
  className = '',
  disableAnimations = false,
  style,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor = DEFAULT_GLOW_COLOR,
  enableTilt = true,
  clickEffect = false,
  enableMagnetism = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isHoveredRef = useRef(false);
  const memoizedParticles = useRef<HTMLDivElement[]>([]);
  const particlesInitialized = useRef(false);
  const magnetismAnimationRef = useRef<gsap.core.Tween | null>(null);

  const initializeParticles = useCallback(() => {
    if (particlesInitialized.current || !cardRef.current) return;

    const { width, height } = cardRef.current.getBoundingClientRect();
    memoizedParticles.current = Array.from({ length: particleCount }, () =>
      createParticleElement(
        Math.random() * width,
        Math.random() * height,
        glowColor,
      ),
    );
    particlesInitialized.current = true;
  }, [particleCount, glowColor]);

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    magnetismAnimationRef.current?.kill();

    particlesRef.current.forEach((particle) => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => {
          particle.parentNode?.removeChild(particle);
        },
      });
    });
    particlesRef.current = [];
  }, []);

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return;

    if (!particlesInitialized.current) {
      initializeParticles();
    }

    memoizedParticles.current.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;

        const clone = particle.cloneNode(true) as HTMLDivElement;
        cardRef.current.appendChild(clone);
        particlesRef.current.push(clone);

        gsap.fromTo(
          clone,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' },
        );

        gsap.to(clone, {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        });

        gsap.to(clone, {
          opacity: 0.3,
          duration: 1.5,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true,
        });
      }, index * 100);

      timeoutsRef.current.push(timeoutId);
    });
  }, [initializeParticles]);

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return;

    const element = cardRef.current;

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
      animateParticles();

      if (enableTilt) {
        gsap.to(element, {
          rotateX: 2,
          rotateY: 2,
          duration: 0.3,
          ease: 'power2.out',
          transformPerspective: 1000,
        });
      }
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      clearAllParticles();

      if (enableTilt) {
        gsap.to(element, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.3,
          ease: 'power2.out',
        });
      }

      if (enableMagnetism) {
        gsap.to(element, {
          x: 0,
          y: 0,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!enableTilt && !enableMagnetism) return;

      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (enableTilt) {
        const rotateX = ((y - centerY) / centerY) * -3;
        const rotateY = ((x - centerX) / centerX) * 3;

        gsap.to(element, {
          rotateX,
          rotateY,
          duration: 0.1,
          ease: 'power2.out',
          transformPerspective: 1000,
        });
      }

      if (enableMagnetism) {
        const magnetX = (x - centerX) * 0.02;
        const magnetY = (y - centerY) * 0.02;

        magnetismAnimationRef.current = gsap.to(element, {
          x: magnetX,
          y: magnetY,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!clickEffect) return;

      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height),
      );

      const ripple = document.createElement('div');
      ripple.style.cssText = `
        position: absolute;
        width: ${maxDistance * 2}px;
        height: ${maxDistance * 2}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(${glowColor}, 0.4) 0%, rgba(${glowColor}, 0.2) 30%, transparent 70%);
        left: ${x - maxDistance}px;
        top: ${y - maxDistance}px;
        pointer-events: none;
        z-index: 1000;
      `;

      element.appendChild(ripple);

      gsap.fromTo(
        ripple,
        {
          scale: 0,
          opacity: 1,
        },
        {
          scale: 1,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => ripple.remove(),
        },
      );
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('click', handleClick);

    return () => {
      isHoveredRef.current = false;
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('click', handleClick);
      clearAllParticles();
    };
  }, [
    animateParticles,
    clearAllParticles,
    disableAnimations,
    enableTilt,
    enableMagnetism,
    clickEffect,
    glowColor,
  ]);

  return (
    <div
      ref={cardRef}
      className={`${className} relative overflow-hidden`}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
    >
      {children}
    </div>
  );
};

const GlobalSpotlight: React.FC<{
  gridRef: React.RefObject<HTMLDivElement | null>;
  disableAnimations?: boolean;
  enabled?: boolean;
  spotlightRadius?: number;
  glowColor?: string;
}> = ({
  gridRef,
  disableAnimations = false,
  enabled = true,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowColor = DEFAULT_GLOW_COLOR,
}) => {
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const isInsideSection = useRef(false);

  useEffect(() => {
    if (disableAnimations || !gridRef?.current || !enabled) return;

    const spotlight = document.createElement('div');
    spotlight.className = 'global-spotlight';
    spotlight.style.cssText = `
      position: fixed;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${glowColor}, 0.15) 0%,
        rgba(${glowColor}, 0.08) 15%,
        rgba(${glowColor}, 0.04) 25%,
        rgba(${glowColor}, 0.02) 40%,
        rgba(${glowColor}, 0.01) 65%,
        transparent 70%
      );
      z-index: 200;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: screen;
    `;
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const handleMouseMove = (e: MouseEvent) => {
      if (!spotlightRef.current || !gridRef.current) return;

      const section = gridRef.current.closest('.bento-section');
      const rect = section?.getBoundingClientRect();
      const mouseInside =
        rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      isInsideSection.current = mouseInside || false;
      const cards = gridRef.current.querySelectorAll('.card');

      if (!mouseInside) {
        gsap.to(spotlightRef.current, {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.out',
        });
        cards.forEach((card) => {
          (card as HTMLElement).style.setProperty('--glow-intensity', '0');
        });
        return;
      }

      const { proximity, fadeDistance } =
        calculateSpotlightValues(spotlightRadius);
      let minDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card) => {
        const cardElement = card as HTMLElement;
        const cardRect = cardElement.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const distance =
          Math.hypot(e.clientX - centerX, e.clientY - centerY) -
          Math.max(cardRect.width, cardRect.height) / 2;
        const effectiveDistance = Math.max(0, distance);

        minDistance = Math.min(minDistance, effectiveDistance);

        let glowIntensity = 0;
        if (effectiveDistance <= proximity) {
          glowIntensity = 1;
        } else if (effectiveDistance <= fadeDistance) {
          glowIntensity =
            (fadeDistance - effectiveDistance) / (fadeDistance - proximity);
        }

        updateCardGlowProperties(
          cardElement,
          e.clientX,
          e.clientY,
          glowIntensity,
          spotlightRadius,
        );
      });

      gsap.to(spotlightRef.current, {
        left: e.clientX,
        top: e.clientY,
        duration: 0.1,
        ease: 'power2.out',
      });

      const targetOpacity =
        minDistance <= proximity
          ? 0.8
          : minDistance <= fadeDistance
            ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.8
            : 0;

      gsap.to(spotlightRef.current, {
        opacity: targetOpacity,
        duration: targetOpacity > 0 ? 0.2 : 0.5,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      isInsideSection.current = false;
      gridRef.current?.querySelectorAll('.card').forEach((card) => {
        (card as HTMLElement).style.setProperty('--glow-intensity', '0');
      });
      if (spotlightRef.current) {
        gsap.to(spotlightRef.current, {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      spotlightRef.current?.parentNode?.removeChild(spotlightRef.current);
    };
  }, [gridRef, disableAnimations, enabled, spotlightRadius, glowColor]);

  return null;
};

const BentoCardGrid: React.FC<{
  children: React.ReactNode;
  gridRef?: React.RefObject<HTMLDivElement | null>;
}> = ({ children, gridRef }) => (
  <div
    className="bento-section grid gap-2 p-3 max-w-[90rem] select-none relative"
    style={{ fontSize: 'clamp(1rem, 0.9rem + 0.5vw, 1.5rem)' }}
    ref={gridRef}
  >
    {children}
  </div>
);

const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () =>
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

const MagicBento: React.FC<BentoProps> = ({
  textAutoHide = true,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = true,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  enableMagnetism = true,
  cards = [],
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobileDetection();
  const shouldDisableAnimations = disableAnimations || isMobile;
  const [animatedCards, setAnimatedCards] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Create random order for card animations
  const animationOrder = useMemo(() => {
    const indices = cards.map((_, index) => index);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [cards.length]);

  useEffect(() => {
    if (shouldDisableAnimations) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardIndex = Number(
              entry.target.getAttribute('data-card-index'),
            );
            if (!Number.isNaN(cardIndex)) {
              const orderIndex = animationOrder.indexOf(cardIndex);
              setTimeout(() => {
                setAnimatedCards((prev) => new Set(prev).add(cardIndex));
              }, orderIndex * 150); // 150ms delay between each card
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      },
    );

    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => {
      observer.disconnect();
    };
  }, [animationOrder, shouldDisableAnimations]);

  return (
    <>
      <style>
        {`
          .bento-section {
            --glow-x: 50%;
            --glow-y: 50%;
            --glow-intensity: 0;
            --glow-radius: 200px;
            --glow-color: ${glowColor};
            --border-color: rgba(255, 255, 255, 0.15);
            --background-dark: rgba(0, 0, 0, 0.6);
          }
          
          @keyframes grain {
            0%, 100% { transform: translate(0, 0) }
            10% { transform: translate(-5%, -10%) }
            20% { transform: translate(-15%, 5%) }
            30% { transform: translate(7%, -25%) }
            40% { transform: translate(-5%, 25%) }
            50% { transform: translate(-15%, 10%) }
            60% { transform: translate(15%, 0%) }
            70% { transform: translate(0%, 15%) }
            80% { transform: translate(3%, 20%) }
            90% { transform: translate(-10%, 10%) }
          }
          
          .noise-overlay {
            position: fixed;
            top: -50%;
            left: -50%;
            right: -50%;
            bottom: -50%;
            width: 200%;
            height: 200%;
            pointer-events: none;
            opacity: 0.03;
            z-index: 1;
            animation: grain 8s steps(10) infinite;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          }
          
          .card-responsive {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
            margin: 0 auto;
            padding: 0.5rem;
            grid-auto-rows: minmax(260px, auto);
          }
          
          @media (min-width: 640px) {
            .card-responsive {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          
          @media (min-width: 1024px) {
            .card-responsive {
              grid-template-columns: repeat(3, 1fr);
              grid-auto-rows: minmax(200px, auto);
            }
            
            /* First row - 3 equal cards */
            .card-responsive .card:nth-child(1) {
              grid-column: 1;
              grid-row: 1;
            }
            
            .card-responsive .card:nth-child(2) {
              grid-column: 2;
              grid-row: 1;
            }
            
            .card-responsive .card:nth-child(3) {
              grid-column: 3;
              grid-row: 1;
            }
            
            /* Second row - 1 wide card, 1 normal card */
            .card-responsive .card:nth-child(4) {
              grid-column: 1 / span 2;
              grid-row: 2;
            }
            
            .card-responsive .card:nth-child(5) {
              grid-column: 3;
              grid-row: 2;
            }
            
            /* Third row - 1 normal card, 1 wide card */
            .card-responsive .card:nth-child(6) {
              grid-column: 1;
              grid-row: 3;
            }
            
            .card-responsive .card:nth-child(7) {
              grid-column: 2 / span 2;
              grid-row: 3;
            }
            
            /* Fourth row - 2 cards */
            .card-responsive .card:nth-child(8) {
              grid-column: 1 / span 2;
              grid-row: 4;
            }
            
            .card-responsive .card:nth-child(9) {
              grid-column: 3;
              grid-row: 4;
            }
          }
          
          .card::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: 
              radial-gradient(circle at var(--glow-x) var(--glow-y),
                rgba(${glowColor}, 0.3) 0%,
                rgba(${glowColor}, 0.15) 20%,
                rgba(${glowColor}, 0.08) 40%,
                transparent 70%),
              linear-gradient(180deg, 
                rgba(255, 255, 255, 0.1) 0%, 
                transparent 50%);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            mix-blend-mode: screen;
          }
          
          .card:hover::before {
            opacity: 0.7;
          }
          
          .card-gradient-overlay {
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: linear-gradient(
              45deg,
              transparent 0%,
              rgba(255, 255, 255, 0.03) 50%,
              transparent 100%
            );
            pointer-events: none;
            mix-blend-mode: overlay;
          }
          
          .card-shine {
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: linear-gradient(
              105deg,
              transparent 40%,
              rgba(255, 255, 255, 0.7) 50%,
              transparent 60%
            );
            pointer-events: none;
            mix-blend-mode: overlay;
            opacity: 0;
            transform: translateX(-100%);
            transition: transform 0.6s ease-out, opacity 0.6s ease-out;
          }
          
          .card:hover .card-shine {
            opacity: 0.05;
            transform: translateX(100%);
          }
          
          .card--noise {
            position: absolute;
            inset: 0;
            border-radius: inherit;
            opacity: 0.12;
            mix-blend-mode: overlay;
            pointer-events: none;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='cardNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23cardNoise)'/%3E%3C/svg%3E");
            filter: contrast(1.2) brightness(1.1);
          }
          
          .card--border-glow::after {
            content: '';
            position: absolute;
            inset: 0;
            padding: 2px;
            background: radial-gradient(var(--glow-radius) circle at var(--glow-x) var(--glow-y),
                rgba(${glowColor}, calc(var(--glow-intensity) * 1)) 0%,
                rgba(${glowColor}, calc(var(--glow-intensity) * 0.6)) 30%,
                transparent 60%);
            border-radius: inherit;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: subtract;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            pointer-events: none;
            transition: opacity 0.3s ease;
            z-index: 1;
          }
          
          .card--border-glow:hover::after {
            opacity: 1;
          }
          
          .card--border-glow:hover {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 30px rgba(${glowColor}, 0.2), inset 0 0 20px rgba(${glowColor}, 0.05);
          }
          
          .particle::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: rgba(${glowColor}, 0.2);
            border-radius: 50%;
            z-index: -1;
          }
          
          .text-clamp-1 {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 1;
            line-clamp: 1;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .text-clamp-2 {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          @media (max-width: 639px) {
            .card-responsive {
              grid-template-columns: 1fr;
              width: 95%;
              margin: 0 auto;
              padding: 0.5rem;
            }
            
            .card-responsive .card {
              width: 100%;
              min-height: 280px;
            }
          }
          
          .card {
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          
          .card-reveal {
            opacity: 0;
            filter: blur(20px);
            transform: translateY(30px) scale(0.95);
            transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .card-reveal.card-revealed {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0) scale(1);
          }
        `}
      </style>

      {enableSpotlight && (
        <GlobalSpotlight
          gridRef={gridRef}
          disableAnimations={shouldDisableAnimations}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={glowColor}
        />
      )}

      <BentoCardGrid gridRef={gridRef}>
        <div className="card-responsive grid gap-4">
          {cards.map((card, index) => {
            const isRevealed = animatedCards.has(index);
            const baseClassName = `card card-reveal ${isRevealed ? 'card-revealed' : ''} flex flex-col justify-between relative min-h-[220px] w-full max-w-full p-5 rounded-[24px] border border-solid font-light overflow-hidden transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:scale-[1.01] ${
              enableBorderGlow ? 'card--border-glow' : ''
            }`;

            const cardStyle = {
              background: `linear-gradient(135deg, ${card.color || 'rgba(0, 0, 0, 0.6)'}, rgba(0, 0, 0, 0.8))`,
              borderColor: 'var(--border-color)',
              backdropFilter: 'blur(20px) saturate(1.8) brightness(1.1)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.8) brightness(1.1)',
              '--glow-x': '50%',
              '--glow-y': '50%',
              '--glow-intensity': '0',
              '--glow-radius': '200px',
            } as React.CSSProperties;

            const cardKey = `${card.title}-${index}`;

            if (enableStars) {
              return (
                <div
                  key={cardKey}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  data-card-index={index}
                >
                  <ParticleCard
                    className={baseClassName}
                    style={cardStyle}
                    disableAnimations={shouldDisableAnimations}
                    particleCount={particleCount}
                    glowColor={glowColor}
                    enableTilt={enableTilt}
                    clickEffect={clickEffect}
                    enableMagnetism={enableMagnetism}
                  >
                    <div className="card-gradient-overlay" />
                    <div className="card--noise" />
                    <div className="card-shine" />
                    <div className="card__header flex justify-between items-start gap-3 relative z-10">
                      {card.icon && (
                        <div className="text-4xl flex-shrink-0">
                          {card.icon}
                        </div>
                      )}
                      {card.label && (
                        <span className="text-sm font-medium text-white/60 uppercase tracking-wider">
                          {card.label}
                        </span>
                      )}
                    </div>
                    <div className="card__content flex flex-col relative mt-auto pt-3 z-10">
                      <h3 className="font-montserrat text-base md:text-lg font-semibold text-white m-0 mb-1.5 leading-tight">
                        {card.title}
                      </h3>
                      <p className="font-montserrat text-xs md:text-sm leading-snug text-white/80">
                        {card.description}
                      </p>
                    </div>
                  </ParticleCard>
                </div>
              );
            }

            return (
              <div
                key={cardKey}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                data-card-index={index}
                className={baseClassName}
                style={cardStyle}
              >
                <div className="card-gradient-overlay" />
                <div className="card--noise" />
                <div className="card-shine" />
                <div className="card__header flex justify-between items-start gap-3 relative z-10">
                  {card.icon && (
                    <div className="text-4xl flex-shrink-0">{card.icon}</div>
                  )}
                  {card.label && (
                    <span className="text-sm font-medium text-white/60 uppercase tracking-wider">
                      {card.label}
                    </span>
                  )}
                </div>
                <div className="card__content flex flex-col relative mt-auto pt-3 z-10">
                  <h3 className="font-montserrat text-base md:text-lg font-semibold text-white m-0 mb-1.5 leading-tight">
                    {card.title}
                  </h3>
                  <p className="font-montserrat text-xs md:text-sm leading-snug text-white/80">
                    {card.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </BentoCardGrid>
    </>
  );
};

export default MagicBento;
