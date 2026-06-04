import React, { useState, useEffect, useRef } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxScrambles?: number;
  className?: string;
  delay?: number;
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+-/\\';

export function DecryptedText({
  text,
  speed = 30,
  maxScrambles = 4,
  className = '',
  delay = 0,
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState('');
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    setDisplayText('');

    const startDecrypt = () => {
      const targetText = textRef.current;
      const length = targetText.length;
      const scrambleCounts = new Array(length).fill(0);
      const revealed = new Array(length).fill(false);

      const intervalId = setInterval(() => {
        if (!active) {
          clearInterval(intervalId);
          return;
        }

        let allRevealed = true;
        const currentResult: string[] = [];

        for (let i = 0; i < length; i++) {
          if (targetText[i] === ' ') {
            currentResult.push(' ');
            revealed[i] = true;
            continue;
          }

          if (revealed[i]) {
            currentResult.push(targetText[i]);
          } else {
            allRevealed = false;
            if (scrambleCounts[i] >= maxScrambles) {
              revealed[i] = true;
              currentResult.push(targetText[i]);
            } else {
              const randomChar = CHARS[Math.floor(Math.random() * CHARS.length)];
              currentResult.push(randomChar);
              scrambleCounts[i]++;
            }
          }
        }

        setDisplayText(currentResult.join(''));

        if (allRevealed) {
          clearInterval(intervalId);
        }
      }, speed);

      return () => clearInterval(intervalId);
    };

    if (delay > 0) {
      timeoutId = setTimeout(() => {
        if (active) startDecrypt();
      }, delay);
    } else {
      startDecrypt();
    }

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [text, speed, maxScrambles, delay]);

  return <span className={className}>{displayText}</span>;
}
