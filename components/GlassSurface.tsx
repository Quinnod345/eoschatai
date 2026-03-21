'use client';

import React, { forwardRef } from 'react';

/**
 * Simplified glass surface — replaces the heavyweight SVG displacement-map
 * version with a plain backdrop-blur + border approach. All original props are
 * accepted so call-sites need zero changes; visual-only props are no-ops.
 */
export interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
  isButton?: boolean;
  isBackdrop?: boolean;
  isToolCall?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  // Legacy visual props — accepted but ignored
  [key: string]: unknown;
}

const GlassSurface = forwardRef<HTMLElement, GlassSurfaceProps>(
  (props, ref) => {
    const {
      children,
      width,
      height,
      borderRadius,
      className = '',
      style,
      isButton = false,
      isBackdrop = false,
      isToolCall: _it,
      onClick,
      disabled,
      type = 'button',
      // consume all legacy visual props so they don't land on DOM nodes
      borderWidth: _bw,
      brightness: _br,
      opacity: _op,
      blur: _bl,
      displace: _dis,
      backgroundOpacity: _bgop,
      saturation: _sat,
      distortionScale: _ds,
      redOffset: _ro,
      greenOffset: _go,
      blueOffset: _bo,
      xChannel: _xc,
      yChannel: _yc,
      mixBlendMode: _mb,
      showInsetShadow: _sis,
      insetShadowIntensity: _ii,
      noTransition: _nt,
      useFallback: _uf,
      ...rest
    } = props;

    const sizeStyle: React.CSSProperties = { ...(style as React.CSSProperties) };
    if (width != null) sizeStyle.width = typeof width === 'number' ? `${width}px` : (width as string);
    if (height != null) sizeStyle.height = typeof height === 'number' ? `${height}px` : (height as string);
    if (borderRadius != null) sizeStyle.borderRadius = `${borderRadius}px`;

    const backdropClasses = isBackdrop === true ? ' absolute inset-0 pointer-events-none' : '';
    const base = `backdrop-blur-md bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/10${backdropClasses} ${String(className)}`.trim();

    // Only pass safe attributes to DOM (data-*, aria-*, id, role, tabIndex)
    const domPassthrough: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (
        k.startsWith('data-') ||
        k.startsWith('aria-') ||
        k === 'id' ||
        k === 'role' ||
        k === 'tabIndex'
      ) {
        domPassthrough[k] = v;
      }
    }

    if (isButton) {
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          className={base}
          style={sizeStyle}
          onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
          disabled={disabled as boolean | undefined}
          type={(type as string) as 'button' | 'submit' | 'reset'}
          {...(domPassthrough as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {children as React.ReactNode}
        </button>
      );
    }

    // Plain container — no inner wrapper div, children render directly so
    // nested buttons/inputs remain fully interactive.
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={base}
        style={sizeStyle}
        {...(domPassthrough as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children as React.ReactNode}
      </div>
    );
  },
);

GlassSurface.displayName = 'GlassSurface';

export default GlassSurface;
