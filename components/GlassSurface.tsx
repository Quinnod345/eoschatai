import React, { useEffect, useRef, useId, forwardRef } from 'react';
import { useTheme } from 'next-themes';

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: 'R' | 'G' | 'B';
  yChannel?: 'R' | 'G' | 'B';
  mixBlendMode?:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity'
    | 'plus-darker'
    | 'plus-lighter';
  className?: string;
  style?: React.CSSProperties;
  showInsetShadow?: boolean;
  insetShadowIntensity?: number; // 0-1 scale, controls opacity of inset shadows
  isBackdrop?: boolean; // If true, renders as absolute backdrop instead of wrapping children
  isButton?: boolean; // If true, renders as a button element
  isToolCall?: boolean; // If true, uses overflow-visible for tool call results
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  noTransition?: boolean; // If true, removes the opacity transition
  useFallback?: boolean; // If true, uses simple backdrop-filter instead of complex SVG filters
}

const GlassSurface = forwardRef<HTMLElement, GlassSurfaceProps>(
  (
    {
      children,
      width = 200,
      height = 80,
      borderRadius = 20,
      borderWidth = 0.07,
      brightness = 50,
      opacity = 0.93,
      blur = 11,
      displace = 0,
      backgroundOpacity = 0,
      saturation = 1,
      distortionScale = -180,
      redOffset = 0,
      greenOffset = 10,
      blueOffset = 20,
      xChannel = 'R',
      yChannel = 'G',
      mixBlendMode = 'difference',
      className = '',
      style = {},
      showInsetShadow = true,
      insetShadowIntensity = 1,
      isBackdrop = false,
      isButton = false,
      isToolCall = false,
      onClick,
      disabled,
      type = 'button',
      noTransition = false,
      useFallback = false,
      ...props
    },
    ref,
  ) => {
    const uniqueId = useId().replace(/:/g, '-');
    const filterId = `glass-filter-${uniqueId}`;
    const redGradId = `red-grad-${uniqueId}`;
    const blueGradId = `blue-grad-${uniqueId}`;

    const containerRef = useRef<HTMLDivElement>(null);
    const feImageRef = useRef<SVGFEImageElement>(null);
    const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
    const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
    const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
    const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);

    const { theme, resolvedTheme } = useTheme();
    // Use resolvedTheme first, fallback to theme, and if neither is available check document
    const isDarkMode =
      (resolvedTheme ?? theme) === 'dark' ||
      (typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark'));

    const generateDisplacementMap = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const actualWidth = rect?.width || 400;
      const actualHeight = rect?.height || 200;
      const edgeSize =
        Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

      const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

      return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
    };

    const updateDisplacementMap = () => {
      feImageRef.current?.setAttribute('href', generateDisplacementMap());
    };

    useEffect(() => {
      // Skip all displacement map work when using fallback
      if (useFallback) return;

      updateDisplacementMap();
      [
        { ref: redChannelRef, offset: redOffset },
        { ref: greenChannelRef, offset: greenOffset },
        { ref: blueChannelRef, offset: blueOffset },
      ].forEach(({ ref, offset }) => {
        if (ref.current) {
          ref.current.setAttribute(
            'scale',
            (distortionScale + offset).toString(),
          );
          ref.current.setAttribute('xChannelSelector', xChannel);
          ref.current.setAttribute('yChannelSelector', yChannel);
        }
      });

      gaussianBlurRef.current?.setAttribute(
        'stdDeviation',
        displace.toString(),
      );
    }, [
      width,
      height,
      borderRadius,
      borderWidth,
      brightness,
      opacity,
      blur,
      displace,
      distortionScale,
      redOffset,
      greenOffset,
      blueOffset,
      xChannel,
      yChannel,
      mixBlendMode,
      useFallback,
    ]);

    useEffect(() => {
      // Skip all displacement map work when using fallback
      if (useFallback || !containerRef.current) return;

      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        updateDisplacementMap();
      });

      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          updateDisplacementMap();
        });
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [useFallback]);

    const supportsSVGFilters = () => {
      // Check if we're in a browser environment
      if (typeof navigator === 'undefined') {
        return true; // Assume support on server, will be checked on client
      }

      const isWebkit =
        /Safari/.test(navigator.userAgent) &&
        !/Chrome/.test(navigator.userAgent);
      const isFirefox = /Firefox/.test(navigator.userAgent);

      if (isWebkit || isFirefox) {
        return false;
      }

      const div = document.createElement('div');
      div.style.backdropFilter = `url(#${filterId})`;
      return div.style.backdropFilter !== '';
    };

    const supportsBackdropFilter = () => {
      if (typeof window === 'undefined') return false;
      return CSS.supports('backdrop-filter', 'blur(10px)');
    };

    const getContainerStyles = (): React.CSSProperties => {
      const baseStyles: React.CSSProperties = {
        ...style,
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: `${borderRadius}px`,
        '--glass-frost': backgroundOpacity,
        '--glass-saturation': saturation,
      } as React.CSSProperties;

      const svgSupported = useFallback ? false : supportsSVGFilters();
      const backdropFilterSupported = supportsBackdropFilter();

      if (svgSupported) {
        const outerShadow = `0px 4px 16px rgba(17, 17, 26, 0.05),
             0px 8px 24px rgba(17, 17, 26, 0.05),
             0px 16px 56px rgba(17, 17, 26, 0.05)`;

        // Calculate adjusted transparency values based on intensity
        // Base transparency: 65% and 85% for dark mode, 85% and 90% for light mode
        // Intensity 0 = fully transparent (100%), Intensity 1 = original values
        const darkTransparency1 = 65 + (100 - 65) * (1 - insetShadowIntensity);
        const darkTransparency2 = 85 + (100 - 85) * (1 - insetShadowIntensity);
        const lightTransparency1 = 85 + (100 - 85) * (1 - insetShadowIntensity);
        const lightTransparency2 = 90 + (100 - 90) * (1 - insetShadowIntensity);

        // Adjust rgba opacity for the smaller inset shadows
        const insetOpacity = 0.05 * insetShadowIntensity;

        const darkInsetShadow = `0 0 2px 1px color-mix(in oklch, white, transparent ${darkTransparency1}%) inset,
             0 0 10px 4px color-mix(in oklch, white, transparent ${darkTransparency2}%) inset,
             0px 4px 16px rgba(17, 17, 26, ${insetOpacity}) inset,
             0px 8px 24px rgba(17, 17, 26, ${insetOpacity}) inset,
             0px 16px 56px rgba(17, 17, 26, ${insetOpacity}) inset`;

        const lightInsetShadow = `0 0 2px 1px color-mix(in oklch, black, transparent ${lightTransparency1}%) inset,
             0 0 10px 4px color-mix(in oklch, black, transparent ${lightTransparency2}%) inset,
             0px 4px 16px rgba(17, 17, 26, ${insetOpacity}) inset,
             0px 8px 24px rgba(17, 17, 26, ${insetOpacity}) inset,
             0px 16px 56px rgba(17, 17, 26, ${insetOpacity}) inset`;

        return {
          ...baseStyles,
          background: isDarkMode
            ? `hsl(0 0% 0% / ${backgroundOpacity})`
            : `hsl(0 0% 100% / ${backgroundOpacity})`,
          backdropFilter: `url(#${filterId}) saturate(${saturation})`,
          boxShadow: showInsetShadow
            ? isDarkMode
              ? `${darkInsetShadow}, ${outerShadow}`
              : `${lightInsetShadow}, ${outerShadow}`
            : outerShadow,
        };
      } else {
        // Fallback shadows with intensity control
        const darkInsetTop = 0.2 * insetShadowIntensity;
        const darkInsetBottom = 0.1 * insetShadowIntensity;
        const lightInsetTop = 0.5 * insetShadowIntensity;
        const lightInsetBottom = 0.3 * insetShadowIntensity;
        const lightInsetTopAlt = 0.4 * insetShadowIntensity;
        const lightInsetBottomAlt = 0.2 * insetShadowIntensity;

        if (isDarkMode) {
          if (!backdropFilterSupported) {
            return {
              ...baseStyles,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: showInsetShadow
                ? `inset 0 1px 0 0 rgba(255, 255, 255, ${darkInsetTop}),
                        inset 0 -1px 0 0 rgba(255, 255, 255, ${darkInsetBottom})`
                : undefined,
            };
          } else {
            return {
              ...baseStyles,
              background: `hsl(0 0% 0% / ${backgroundOpacity})`,
              backdropFilter: `blur(${typeof blur === 'number' ? blur : 12}px)`,
              WebkitBackdropFilter: `blur(${typeof blur === 'number' ? blur : 12}px)`,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: showInsetShadow
                ? `inset 0 1px 0 0 rgba(255, 255, 255, ${darkInsetTop}),
                        inset 0 -1px 0 0 rgba(255, 255, 255, ${darkInsetBottom})`
                : undefined,
            };
          }
        } else {
          if (!backdropFilterSupported) {
            return {
              ...baseStyles,
              background: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: showInsetShadow
                ? `inset 0 1px 0 0 rgba(255, 255, 255, ${lightInsetTop}),
                        inset 0 -1px 0 0 rgba(255, 255, 255, ${lightInsetBottom})`
                : undefined,
            };
          } else {
            return {
              ...baseStyles,
              background: `hsl(0 0% 100% / ${backgroundOpacity})`,
              backdropFilter: `blur(${typeof blur === 'number' ? blur : 12}px)`,
              WebkitBackdropFilter: `blur(${typeof blur === 'number' ? blur : 12}px)`,
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: showInsetShadow
                ? `0 8px 32px 0 rgba(31, 38, 135, 0.2),
                        0 2px 16px 0 rgba(31, 38, 135, 0.1),
                        inset 0 1px 0 0 rgba(255, 255, 255, ${lightInsetTopAlt}),
                        inset 0 -1px 0 0 rgba(255, 255, 255, ${lightInsetBottomAlt})`
                : `0 8px 32px 0 rgba(31, 38, 135, 0.2),
                        0 2px 16px 0 rgba(31, 38, 135, 0.1)`,
            };
          }
        }
      }
    };

    const transitionClass = noTransition
      ? ''
      : 'transition-opacity duration-[260ms] ease-out';
    const overflowClass = isToolCall ? 'overflow-visible' : 'overflow-hidden';
    const glassSurfaceClasses = isBackdrop
      ? `absolute inset-0 ${overflowClass} ${transitionClass} pointer-events-none`
      : `relative flex items-center justify-center ${overflowClass} ${transitionClass}`;

    const focusVisibleClasses = isDarkMode
      ? 'focus-visible:outline-2 focus-visible:outline-[#0A84FF] focus-visible:outline-offset-2'
      : 'focus-visible:outline-2 focus-visible:outline-[#007AFF] focus-visible:outline-offset-2';

    // Backdrop mode: render glass effect as absolute background
    if (isBackdrop) {
      return (
        <div
          ref={containerRef as any}
          className={`${glassSurfaceClasses} ${className}`}
          style={getContainerStyles()}
          {...props}
        >
          {!useFallback && (
            <svg
              className="w-full h-full pointer-events-none absolute inset-0 opacity-0 -z-10"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <filter
                  id={filterId}
                  colorInterpolationFilters="sRGB"
                  x="0%"
                  y="0%"
                  width="100%"
                  height="100%"
                >
                  <feImage
                    ref={feImageRef}
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    preserveAspectRatio="none"
                    result="map"
                  />

                  <feDisplacementMap
                    ref={redChannelRef}
                    in="SourceGraphic"
                    in2="map"
                    id="redchannel"
                    result="dispRed"
                  />
                  <feColorMatrix
                    in="dispRed"
                    type="matrix"
                    values="1 0 0 0 0
                          0 0 0 0 0
                          0 0 0 0 0
                          0 0 0 1 0"
                    result="red"
                  />

                  <feDisplacementMap
                    ref={greenChannelRef}
                    in="SourceGraphic"
                    in2="map"
                    id="greenchannel"
                    result="dispGreen"
                  />
                  <feColorMatrix
                    in="dispGreen"
                    type="matrix"
                    values="0 0 0 0 0
                          0 1 0 0 0
                          0 0 0 0 0
                          0 0 0 1 0"
                    result="green"
                  />

                  <feDisplacementMap
                    ref={blueChannelRef}
                    in="SourceGraphic"
                    in2="map"
                    id="bluechannel"
                    result="dispBlue"
                  />
                  <feColorMatrix
                    in="dispBlue"
                    type="matrix"
                    values="0 0 0 0 0
                          0 0 0 0 0
                          0 0 1 0 0
                          0 0 0 1 0"
                    result="blue"
                  />

                  <feBlend in="red" in2="green" mode="screen" result="rg" />
                  <feBlend in="rg" in2="blue" mode="screen" result="output" />
                  <feGaussianBlur
                    ref={gaussianBlurRef}
                    in="output"
                    stdDeviation="0.7"
                  />
                </filter>
              </defs>
            </svg>
          )}
        </div>
      );
    }

    // Normal mode: wrap children
    const Element = isButton ? 'button' : 'div';

    // Extract onClick from props to avoid duplication
    const { onClick: propsOnClick, ...restProps } = props as any;

    // Merge onClick handlers if both exist (for Radix asChild pattern)
    const mergedOnClick = (e: React.MouseEvent<HTMLElement>) => {
      if (onClick) onClick();
      if (propsOnClick) propsOnClick(e);
    };

    const elementProps = isButton
      ? {
          onClick: onClick || propsOnClick ? mergedOnClick : undefined,
          disabled,
          type,
        }
      : {};

    return (
      <Element
        ref={(node: HTMLElement | null) => {
          // Handle both internal ref and forwarded ref
          if (containerRef) {
            (containerRef as any).current = node;
          }
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            (ref as any).current = node;
          }
        }}
        className={`${glassSurfaceClasses} ${focusVisibleClasses} ${className}`}
        style={getContainerStyles()}
        {...restProps}
        {...elementProps}
      >
        {!useFallback && (
          <svg
            className="w-full h-full pointer-events-none absolute inset-0 opacity-0 -z-10"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter
                id={filterId}
                colorInterpolationFilters="sRGB"
                x="0%"
                y="0%"
                width="100%"
                height="100%"
              >
                <feImage
                  ref={feImageRef}
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                  result="map"
                />

                <feDisplacementMap
                  ref={redChannelRef}
                  in="SourceGraphic"
                  in2="map"
                  id="redchannel"
                  result="dispRed"
                />
                <feColorMatrix
                  in="dispRed"
                  type="matrix"
                  values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                  result="red"
                />

                <feDisplacementMap
                  ref={greenChannelRef}
                  in="SourceGraphic"
                  in2="map"
                  id="greenchannel"
                  result="dispGreen"
                />
                <feColorMatrix
                  in="dispGreen"
                  type="matrix"
                  values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                  result="green"
                />

                <feDisplacementMap
                  ref={blueChannelRef}
                  in="SourceGraphic"
                  in2="map"
                  id="bluechannel"
                  result="dispBlue"
                />
                <feColorMatrix
                  in="dispBlue"
                  type="matrix"
                  values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                  result="blue"
                />

                <feBlend in="red" in2="green" mode="screen" result="rg" />
                <feBlend in="rg" in2="blue" mode="screen" result="output" />
                <feGaussianBlur
                  ref={gaussianBlurRef}
                  in="output"
                  stdDeviation="0.7"
                />
              </filter>
            </defs>
          </svg>
        )}

        <div className="w-full h-full flex items-center justify-center p-2 rounded-[inherit] relative z-10">
          {children}
        </div>
      </Element>
    );
  },
);

GlassSurface.displayName = 'GlassSurface';

export default GlassSurface;
