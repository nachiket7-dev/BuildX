import React from 'react';
import { motion } from 'framer-motion';

interface StaggerGridContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  delay?: number;
}

export function StaggerGridContainer({
  children,
  className = '',
  staggerDelay = 0.06,
  delay = 0,
}: StaggerGridContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerGridItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerGridItem({ children, className = '' }: StaggerGridItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.97 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1],
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
