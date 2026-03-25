'use client';

import { useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';

// ─── Spring presets ──────────────────────────────────────────────────────────
//
// springChat     – general chat surfaces (reply indicator, sheet, list rows)
// springSnappy   – small interactive chips and persona pills
// springSoft     – slow FABs, scroll controls, background overlays
// springComposer – panel-sized elements that travel large distances (composer)

export const springChat: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 26,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
};

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 20,
};

/** Heavier spring for full-viewport composer panels that travel large distances. */
export const springComposer: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 30,
};

// ─── Reduced-motion helper ────────────────────────────────────────────────────
//
// Use inside a component:
//   const noMotion = useNoMotion();
//   <motion.div {...(noMotion ? INSTANT : { initial, animate, exit, transition })} />
//
// Or inline with the helpers below.

export function useNoMotion(): boolean {
  return useReducedMotion() ?? false;
}

/** Instant props: cancel all animation when reduced-motion is requested. */
export const INSTANT = {
  initial: false as const,
  transition: { duration: 0 },
} as const;

/**
 * Picks between animated props and instant props based on the user's
 * `prefers-reduced-motion` media query.
 *
 * Usage:
 *   const noMotion = useNoMotion();
 *   <motion.div {...motionSafe(noMotion, { initial, animate, exit, transition })} />
 */
export function motionSafe<T extends Record<string, unknown>>(
  noMotion: boolean,
  props: T,
): T | typeof INSTANT {
  return noMotion ? (INSTANT as unknown as T) : props;
}
