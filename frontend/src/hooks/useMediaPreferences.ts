import { useEffect, useState } from 'react';

export interface MediaPreferences {
  /** User prefers reduced motion (OS setting) */
  reducedMotion: boolean;
  /** Touch-first device — skip custom cursor */
  coarsePointer: boolean;
  /** Safe to run heavy canvas / cursor effects */
  richEffects: boolean;
}

export function useMediaPreferences(): MediaPreferences {
  const [prefs, setPrefs] = useState<MediaPreferences>(() => readPrefs());

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(pointer: coarse)');

    const update = () => setPrefs(readPrefs());

    motion.addEventListener('change', update);
    pointer.addEventListener('change', update);
    return () => {
      motion.removeEventListener('change', update);
      pointer.removeEventListener('change', update);
    };
  }, []);

  return prefs;
}

function readPrefs(): MediaPreferences {
  if (typeof window === 'undefined') {
    return { reducedMotion: false, coarsePointer: false, richEffects: true };
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return {
    reducedMotion,
    coarsePointer,
    richEffects: !reducedMotion && !coarsePointer,
  };
}
