import { lazy, Suspense } from 'react';
import { useMediaPreferences } from '../hooks/useMediaPreferences';

const Aurora = lazy(() => import('./Aurora').then((m) => ({ default: m.Aurora })));
const BlobCursor = lazy(() => import('./BlobCursor').then((m) => ({ default: m.BlobCursor })));

const AURORA_STOPS: [string, string, string] = ['#7C7CF4', '#34D399', '#7C7CF4'];

export function AmbientBackground() {
  const { richEffects, reducedMotion } = useMediaPreferences();

  return (
    <div className="ambient-stack" aria-hidden>
      <Suspense fallback={<div className="aurora-fallback" />}>
        <Aurora
          colorStops={AURORA_STOPS}
          amplitude={richEffects ? 1.0 : 0.85}
          blend={richEffects ? 0.5 : 0.45}
          speed={richEffects ? 1.0 : reducedMotion ? 0.15 : 0.4}
        />
      </Suspense>

      <div className="grid-bg" />

      {richEffects && (
        <Suspense fallback={null}>
          <BlobCursor />
        </Suspense>
      )}

      <div className="grain-overlay" />
      <div className="vignette-overlay vignette-overlay--aurora" />
    </div>
  );
}
