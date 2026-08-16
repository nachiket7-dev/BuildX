import { lazy, Suspense } from 'react';
import { useMediaPreferences } from '../hooks/useMediaPreferences';

const Aurora = lazy(() => import('./Aurora').then((m) => ({ default: m.Aurora })));
const BlobCursor = lazy(() => import('./BlobCursor').then((m) => ({ default: m.BlobCursor })));

const AURORA_STOPS: [string, string, string] = ['#059669', '#10B981', '#047857'];

export function AmbientBackground() {
  const { richEffects, reducedMotion } = useMediaPreferences();

  return (
    <div className="ambient-stack" aria-hidden>
      {/* Top ambient emerald mesh gradient from Commit 887bd41 */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% -10%, #063826 0%, #081C14 45%, #050807 90%)',
        }}
      />
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
