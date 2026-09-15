import { BrandMark } from "./Logo";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** A readable brand entrance, separate from actual route loading. */
export function LandingPreloader({ onComplete }: { onComplete: () => void }) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);
  const done = useRef(onComplete);
  done.current = onComplete;
  useEffect(() => {
    // Completion follows the clock, not a motion callback that can be interrupted.
    const hold = setTimeout(() => setLeaving(true), reduced ? 1700 : 2350);
    const finish = setTimeout(
      () => {
        if (!finished.current) {
          finished.current = true;
          done.current();
        }
      },
      reduced ? 1850 : 2800,
    );
    return () => {
      clearTimeout(hold);
      clearTimeout(finish);
    };
  }, [reduced]);
  function complete() {
    if (finished.current) return;
    finished.current = true;
    done.current();
  }
  return (
    <motion.div
      className="brand-entrance"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduced ? 0.15 : 0.4 }}
    >
      <div className="entrance-grid" aria-hidden="true" />
      <div className="entrance-blueprint" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <span className="entrance-caption">FROM IDEA TO ARCHITECTURE</span>
      <div
        className="entrance-center"
        role="status"
        aria-label="Opening BuildX"
      >
        <BrandMark className="entrance-symbol" />
        <div className="entrance-wordmark" aria-hidden="true">
          {"BuildX".split("").map((letter, index) => (
            <span key={index}>
              <motion.b
                initial={{ y: reduced ? 0 : "105%", opacity: reduced ? 1 : 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.4,
                  delay: 0.25 + index * 0.035,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {letter}
              </motion.b>
            </span>
          ))}
        </div>
        <div className="entrance-line" aria-hidden="true">
          <i />
        </div>
        <p>A foundation for what comes next.</p>
      </div>
      <button type="button" className="entrance-skip" onClick={complete}>
        Continue to BuildX <span aria-hidden="true">↗</span>
      </button>
    </motion.div>
  );
}
