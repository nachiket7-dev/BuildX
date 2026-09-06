import { motion } from 'framer-motion';

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
  wordDelay?: number;
  /** Words (exact match, case-insensitive, punctuation allowed) rendered with the accent editorial style */
  accentWords?: string[];
}

export function TextReveal({
  text,
  className = '',
  delay = 0,
  wordDelay = 0.04,
  accentWords = [],
}: TextRevealProps) {
  const words = text.split(' ');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: wordDelay,
        delayChildren: delay,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 12,
      filter: 'blur(4px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <motion.span
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className={`inline-flex flex-wrap gap-x-[0.25em] ${className}`}
    >
      {words.map((word, idx) => {
        const isAccent = accentWords.some(
          (w) => word.toLowerCase().replace(/[^a-z]/gi, '') === w.toLowerCase(),
        );
        return (
          <motion.span
            key={idx}
            variants={wordVariants}
            className={`inline-block${isAccent ? ' hero-accent-word' : ''}`}
          >
            {word}
          </motion.span>
        );
      })}
    </motion.span>
  );
}
