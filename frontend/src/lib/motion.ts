/**
 * BuildX — Centralized Framer Motion Variant Library
 *
 * Import from here for consistent animation physics across all pages.
 * All variants use the same spring constants to feel cohesive.
 */

import type { Variants } from 'framer-motion';

// ─── Spring Presets ──────────────────────────────────────────────────────────

export const SPRING_SNAPPY = { type: 'spring', stiffness: 380, damping: 32 } as const;
export const SPRING_GENTLE = { type: 'spring', stiffness: 260, damping: 28 } as const;
export const SPRING_SLOW   = { type: 'spring', stiffness: 180, damping: 30 } as const;
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// ─── Page-Level Transitions ──────────────────────────────────────────────────

/** Scale + opacity crossfade used for route transitions via AnimatePresence */
export const pageCrossfade: Variants = {
  hidden: { opacity: 0, scale: 0.985, y: 8, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.38, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    y: -4,
    filter: 'blur(2px)',
    transition: { duration: 0.22, ease: 'easeIn' },
  },
};

// ─── Sidebar / Drawer ────────────────────────────────────────────────────────

/** Spring-physics sidebar slide — used in AgentPage left/right panel collapse */
export const springSidebar = (direction: 'left' | 'right' = 'left'): Variants => ({
  open: {
    x: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { ...SPRING_GENTLE, delay: 0 },
  },
  closed: {
    x: direction === 'left' ? '-100%' : '100%',
    opacity: 0,
    filter: 'blur(4px)',
    transition: { ...SPRING_GENTLE },
  },
});

// ─── Tab Pill Indicator ───────────────────────────────────────────────────────

/** Used with layoutId="tabPill" for morphing active tab underline/background */
export const tabPill: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show:   { opacity: 1, scale: 1, transition: { ...SPRING_SNAPPY } },
  exit:   { opacity: 0, scale: 0.9, transition: { duration: 0.12 } },
};

// ─── Timeline / Feed Nodes ────────────────────────────────────────────────────

/** Timeline event node slide-in — used in RefinementChat timeline feed */
export const timelineNodeSlide: Variants = {
  hidden: { opacity: 0, x: -16, filter: 'blur(3px)' },
  show: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { ...SPRING_GENTLE },
  },
};

export const timelineContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

// ─── Stagger Containers ───────────────────────────────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
  },
};

// ─── Card / Surface Entrance ──────────────────────────────────────────────────

export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...SPRING_GENTLE },
  },
};

/** Right-column slide-in (Hero preview card, Gallery slide-over) */
export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 40, scale: 0.95, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.65, ease: EASE_OUT_EXPO, delay: 0.18 },
  },
};

// ─── Pipeline / Progress Nodes ────────────────────────────────────────────────

/** Simulated pipeline node pulse — used in Hero pipeline widget */
export const pipelineNode: Variants = {
  idle:    { scale: 1, opacity: 0.5 },
  active:  { scale: 1.08, opacity: 1, transition: { ...SPRING_SNAPPY } },
  done:    { scale: 1, opacity: 0.8, transition: { duration: 0.3 } },
};

export const pipelineBar: Variants = {
  idle:    { scaleX: 0, opacity: 0 },
  filling: { scaleX: 1, opacity: 1, transition: { duration: 1.8, ease: 'easeInOut' } },
  done:    { scaleX: 1, opacity: 0.4 },
};

// ─── Modal / Overlay ──────────────────────────────────────────────────────────

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.2 } },
  exit:   { opacity: 0, transition: { duration: 0.18 } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 16, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { ...SPRING_SNAPPY },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    filter: 'blur(4px)',
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

// ─── Floating Command Dock ────────────────────────────────────────────────────

export const commandDock: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { ...SPRING_GENTLE, delay: 0.1 },
  },
};
