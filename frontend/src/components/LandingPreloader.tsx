import { BrandMark, BrandWordmark } from "./Logo";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** A readable brand entrance, separate from actual route loading. */
type HandoffPiece = { x: number; y: number; scale: number };
type BrandHandoff = { mark: HandoffPiece; name: HandoffPiece };

function destination(from: DOMRect, to: DOMRect): HandoffPiece {
  return {
    x: to.left + to.width / 2 - from.left - from.width / 2,
    y: to.top + to.height / 2 - from.top - from.height / 2,
    scale: to.height / from.height,
  };
}

export function LandingPreloader({ onComplete }: { onComplete: () => void }) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const [handoff, setHandoff] = useState<BrandHandoff | null>(null);
  const entranceMark = useRef<HTMLDivElement>(null);
  const entranceName = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const done = useRef(onComplete);
  done.current = onComplete;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    // The entrance is a brand moment; completion never depends on animation events.
    const hold = setTimeout(() => {
      if (!reduced && entranceMark.current && entranceName.current) {
        const target = document.querySelector<HTMLElement>(
          ".boot-content a.brand-lockup > .brand-lockup",
        );
        const targetMark = target?.querySelector<SVGSVGElement>(".buildx-symbol");
        const targetName = target?.querySelector<HTMLElement>(".brand-wordmark");
        if (targetMark && targetName) {
          const fromMark = entranceMark.current.getBoundingClientRect();
          const fromName = entranceName.current.getBoundingClientRect();
          const toMark = targetMark.getBoundingClientRect();
          const toName = targetName.getBoundingClientRect();
          if (fromMark.height > 0 && fromName.height > 0 && toMark.height > 0 && toName.height > 0) {
            setHandoff({
              mark: destination(fromMark, toMark),
              name: destination(fromName, toName),
            });
          }
        }
      }
      setLeaving(true);
    }, reduced ? 350 : 1850);
    const finish = setTimeout(
      () => {
        if (!finished.current) {
          finished.current = true;
          done.current();
        }
      },
      reduced ? 550 : 2450,
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
      className={`brand-entrance${leaving ? " brand-entrance--leaving" : ""}`}
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduced ? 0.15 : 0.34, delay: leaving && !reduced ? 0.25 : 0 }}
    >
      <div className="entrance-grid" aria-hidden="true" />
      <div
        className="entrance-center"
        role="status"
        aria-label="Opening BuildX"
      >
        <span className="entrance-caption">FROM IDEA TO ARCHITECTURE</span>
        <div className="entrance-emblem">
          <motion.div
            ref={entranceMark}
            className="entrance-mark"
            aria-hidden="true"
            initial={false}
            animate={leaving
              ? { x: handoff?.mark.x ?? 0, y: handoff?.mark.y ?? -14, scale: handoff?.mark.scale ?? 0.85, opacity: handoff ? 1 : 0 }
              : { x: 0, y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <BrandMark className="entrance-symbol" />
          </motion.div>
        </div>
        <motion.div
          ref={entranceName}
          className="entrance-name"
          aria-hidden="true"
          initial={false}
          animate={leaving
            ? { x: handoff?.name.x ?? 0, y: handoff?.name.y ?? -14, scale: handoff?.name.scale ?? 0.85, opacity: handoff ? 1 : 0 }
            : { x: 0, y: 0, scale: 1, opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="entrance-name-art"><BrandWordmark /></div>
        </motion.div>
        <div className="entrance-rule" aria-hidden="true"><span /></div>
        <p>A foundation for what comes next.</p>
      </div>
      <button type="button" className="entrance-skip" onClick={complete}>
        Continue to BuildX <span aria-hidden="true">↗</span>
      </button>
    </motion.div>
  );
}
