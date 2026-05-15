import type { Transition, Variants } from 'framer-motion'

export const classroomSpring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 36,
  mass: 0.72,
}

export const classroomQuickTransition: Transition = {
  duration: 0.18,
  ease: 'easeOut',
}

export const classroomSpinTransition: Transition = {
  duration: 0.9,
  ease: 'linear',
  repeat: Infinity,
}

export const classroomFadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: classroomSpring,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: classroomQuickTransition,
  },
}

export const classroomCardVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.995 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: classroomSpring,
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.995,
    transition: classroomQuickTransition,
  },
}

export const classroomStaggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.03,
    },
  },
}

export const classroomCollapseVariants: Variants = {
  collapsed: {
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: 0.18, ease: 'easeInOut' },
      opacity: { duration: 0.12, ease: 'easeOut' },
    },
  },
  expanded: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: { duration: 0.22, ease: 'easeOut' },
      opacity: { duration: 0.16, ease: 'easeOut' },
    },
  },
}

export const classroomOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: classroomQuickTransition,
  },
  exit: {
    opacity: 0,
    transition: classroomQuickTransition,
  },
}

export const classroomDrawerVariants: Variants = {
  hidden: { x: '100%', opacity: 0.96 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 360,
      damping: 34,
      mass: 0.76,
    },
  },
  exit: {
    x: '100%',
    opacity: 0.96,
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
}
