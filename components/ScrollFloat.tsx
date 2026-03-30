import React, {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollFloatProps {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
  splitBy?: 'characters' | 'words';
  useBlur?: boolean;
  blurAmount?: number;
}

const ScrollFloat: React.FC<ScrollFloatProps> = ({
  children,
  scrollContainerRef,
  containerClassName = '',
  textClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'center bottom+=50%',
  scrollEnd = 'bottom bottom-=40%',
  stagger = 0.03,
  splitBy = 'characters',
  useBlur = false,
  blurAmount = 10,
}) => {
  const containerRef = useRef<HTMLHeadingElement>(null);

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';

    if (splitBy === 'words') {
      return text.split(' ').map((word, index) => (
        <span className="inline-block word" key={index}>
          {word}
          {index < text.split(' ').length - 1 ? '\u00A0' : ''}
        </span>
      ));
    }

    return text.split('').map((char, index) => (
      <span className="inline-block word" key={index}>
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  }, [children, splitBy]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller = scrollContainerRef?.current ?? window;

    const charElements = el.querySelectorAll('.inline-block');

    const fromProps = useBlur
      ? {
          willChange: 'opacity, transform, filter',
          opacity: 0,
          yPercent: 120,
          scaleY: 2.3,
          scaleX: 0.7,
          filter: `blur(${blurAmount}px)`,
          transformOrigin: '50% 0%',
        }
      : {
          willChange: 'opacity, transform',
          opacity: 0,
          yPercent: 120,
          scaleY: 2.3,
          scaleX: 0.7,
          transformOrigin: '50% 0%',
        };

    const toProps = useBlur
      ? {
          duration: animationDuration,
          ease: ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          filter: 'blur(0px)',
          stagger: stagger,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: scrollStart,
            end: scrollEnd,
            scrub: true,
          },
        }
      : {
          duration: animationDuration,
          ease: ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger: stagger,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: scrollStart,
            end: scrollEnd,
            scrub: true,
          },
        };

    gsap.fromTo(charElements, fromProps, toProps);
  }, [
    scrollContainerRef,
    animationDuration,
    ease,
    scrollStart,
    scrollEnd,
    stagger,
    useBlur,
    blurAmount,
  ]);

  return (
    <h2
      ref={containerRef}
      className={`my-5 overflow-hidden ${containerClassName}`}
    >
      <span
        className={`inline-block text-[clamp(1.6rem,4vw,3rem)] leading-[1.5] ${textClassName}`}
      >
        {splitText}
      </span>
    </h2>
  );
};

export default ScrollFloat;
