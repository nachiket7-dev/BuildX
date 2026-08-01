import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children: ReactNode;
  viewKey: string;
}

const pageVariants = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -8,
    transition: {
      duration: 0.15,
      ease: [0.7, 0, 1, 0.3] as [number, number, number, number],
    },
  },
};

export function PageTransition({ children, viewKey }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="page-view page-view--stagger will-change-transform"
        style={{ transformOrigin: 'center top' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
