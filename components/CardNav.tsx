import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowTopRightIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

type CardNavLink = {
  label: string;
  href: string;
  ariaLabel: string;
};

export type CardNavItem = {
  label: string;
  href?: string;
  bgColor?: string;
  bgImage?: string;
  textColor: string;
  links: CardNavLink[];
};

export interface CardNavProps {
  logo: React.ReactNode;
  logoAlt?: string;
  items: CardNavItem[];
  className?: string;
  ease?: string;
  ctaButton?: React.ReactNode;
}

const CardNav: React.FC<CardNavProps> = ({
  logo,
  logoAlt = 'Logo',
  items,
  className = '',
  ease = 'power3.out',
  ctaButton,
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content') as HTMLElement;
      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position = 'static';
        contentEl.style.height = 'auto';

        contentEl.offsetHeight;

        const topBar = 64;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }
    return 280;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 64, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease,
    });

    tl.to(
      cardsRef.current,
      { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 },
      '-=0.1',
    );

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [ease, items]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <nav
      ref={navRef}
      className={`card-nav ${isExpanded ? 'open' : ''} relative overflow-hidden will-change-[height] w-full h-full ${className}`}
    >
      <div className="card-nav-top absolute inset-x-0 top-0 h-[64px] flex items-center justify-between px-6 py-3 z-[2]">
        <div
          className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''} group h-full flex flex-col items-center justify-center cursor-pointer gap-[6px] order-2 md:order-none`}
          onClick={toggleMenu}
          role="button"
          aria-label={isExpanded ? 'Close menu' : 'Open menu'}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMenu();
            }
          }}
          style={{ color: '#fff' }}
        >
          <div
            className={`hamburger-line w-[30px] h-[2px] bg-current transition-[transform,opacity,margin] duration-300 ease-linear [transform-origin:50%_50%] ${
              isHamburgerOpen ? 'translate-y-[4px] rotate-45' : ''
            } group-hover:opacity-75`}
          />
          <div
            className={`hamburger-line w-[30px] h-[2px] bg-current transition-[transform,opacity,margin] duration-300 ease-linear [transform-origin:50%_50%] ${
              isHamburgerOpen ? '-translate-y-[4px] -rotate-45' : ''
            } group-hover:opacity-75`}
          />
        </div>

        <div className="logo-container flex items-center md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 order-1 md:order-none">
          {logo}
        </div>

        {ctaButton && (
          <div className="hidden md:flex items-center gap-3">{ctaButton}</div>
        )}
      </div>

      <div
        className={`card-nav-content absolute left-0 right-0 top-[64px] bottom-0 p-2 flex flex-col items-stretch gap-2 justify-start z-[1] ${
          isExpanded
            ? 'visible pointer-events-auto'
            : 'invisible pointer-events-none'
        } md:flex-row md:items-end md:gap-[12px]`}
        aria-hidden={!isExpanded}
      >
        {(items || []).slice(0, 3).map((item, idx) => (
          <div
            key={`${item.label}-${idx}`}
            className="nav-card select-none relative flex flex-col gap-2 px-4 pt-3 pb-6 rounded-3xl min-w-0 flex-[1_1_auto] h-auto min-h-[60px] md:h-full md:min-h-0 md:flex-[1_1_0%] bg-cover bg-center"
            ref={setCardRef(idx)}
            style={{
              backgroundColor: item.bgColor,
              backgroundImage: item.bgImage
                ? `url(${item.bgImage})`
                : undefined,
              color: item.textColor,
            }}
          >
            {item.href ? (
              <Link href={item.href} className="nav-card-label font-montserrat font-normal tracking-[-0.5px] text-[18px] md:text-[22px] hover:opacity-80 transition-opacity">
                {item.label}
              </Link>
            ) : (
              <div className="nav-card-label font-montserrat font-normal tracking-[-0.5px] text-[18px] md:text-[22px]">
                {item.label}
              </div>
            )}
            <div className="nav-card-links mt-auto flex flex-col gap-[2px]">
              {item.links?.map((lnk, i) => (
                <Link
                  key={`${lnk.label}-${i}`}
                  className="nav-card-link inline-flex items-center gap-[6px] no-underline cursor-pointer transition-opacity duration-300 hover:opacity-75 text-[15px] md:text-[16px] font-montserrat"
                  href={lnk.href}
                  aria-label={lnk.ariaLabel}
                  prefetch
                >
                  <ArrowTopRightIcon
                    className="nav-card-link-icon shrink-0 w-4 h-4"
                    aria-hidden="true"
                  />
                  {lnk.label}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {ctaButton && (
          <div className="flex md:hidden items-center justify-center gap-3 px-4 py-3">
            {ctaButton}
          </div>
        )}
      </div>
    </nav>
  );
};

export default CardNav;
