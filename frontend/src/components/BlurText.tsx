import React, { useEffect, useState } from 'react';

interface BlurTextProps {
  text: string;
  delay?: number; // start delay in ms
  stagger?: number; // stagger delay between letters in ms
  className?: string;
  /** When set, each letter uses an animated gradient fill (use hex/rgb, not CSS vars). */
  gradientColors?: string[];
}

export function BlurText({
  text,
  delay = 50,
  stagger = 35,
  className = '',
  gradientColors,
}: BlurTextProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Split into words, then letters to preserve word-wrap behavior
  const words = text.split(' ');

  let characterIndexCounter = 0;

  return (
    <span className={`inline-block ${className}`}>
      {words.map((word, wordIdx) => (
        <span key={wordIdx} className="inline-block whitespace-nowrap mr-[0.25em]">
          {word.split('').map((char) => {
            const index = characterIndexCounter++;
            return (
              <span
                key={index}
                className={`inline-block transition-all ease-out ${gradientColors ? 'hero-gradient-letter' : ''}`}
                style={{
                  opacity: mounted ? 1 : 0,
                  filter: mounted ? 'blur(0px)' : 'blur(10px)',
                  transform: mounted ? 'translateY(0)' : 'translateY(8px)',
                  transitionDuration: '500ms',
                  transitionDelay: `${index * stagger}ms`,
                  ...(gradientColors
                    ? {
                        backgroundImage: `linear-gradient(90deg, ${gradientColors.join(', ')})`,
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }
                    : {}),
                }}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
