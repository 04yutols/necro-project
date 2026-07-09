import type { Variants } from 'framer-motion';

export const MOTION = {
  spring: {
    standard: { type: 'spring', stiffness: 295, damping: 33 },
    soft: { type: 'spring', stiffness: 260, damping: 28 },
    snappy: { type: 'spring', stiffness: 330, damping: 34 },
  },
  duration: {
    fast: 0.16,
    normal: 0.22,
    slow: 0.38,
  },
} as const;

export const APP_TAB_ORDER = ['HOME', 'MAP', 'BATTLE', 'EQUIP', 'JOB', 'LAB', 'YOMI', 'LOGS'] as const;

type TabId = typeof APP_TAB_ORDER[number];

export function getNavigationDirection(
  previous: string,
  current: string,
  order: readonly string[] = APP_TAB_ORDER,
): -1 | 0 | 1 {
  if (previous === current) return 0;
  const previousIndex = order.indexOf(previous as TabId);
  const currentIndex = order.indexOf(current as TabId);
  if (previousIndex < 0 || currentIndex < 0) return 0;
  return currentIndex > previousIndex ? 1 : -1;
}

export const tabScreenVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * 28,
    filter: 'blur(8px)',
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * -28,
    filter: 'blur(8px)',
  }),
};

export const fullscreenScreenVariants: Variants = {
  enter: { opacity: 0, scale: 0.985, filter: 'blur(6px)' },
  center: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.01, filter: 'blur(6px)' },
};
