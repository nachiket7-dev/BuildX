import type { PartialBlueprint } from '../lib/types';

const SECTIONS: { key: keyof PartialBlueprint; label: string }[] = [
  { key: 'appName', label: 'Product' },
  { key: 'features', label: 'Features' },
  { key: 'schema', label: 'Schema' },
  { key: 'endpoints', label: 'API' },
  { key: 'screens', label: 'UI' },
  { key: 'architecture', label: 'Arch' },
  { key: 'code', label: 'Code' },
  { key: 'effort', label: 'Effort' },
];

interface StreamingSectionsProps {
  partial: PartialBlueprint;
}

export function StreamingSections({ partial }: StreamingSectionsProps) {
  return (
    <div
      className="w-full max-w-4xl flex flex-wrap justify-center gap-2 mb-6"
      aria-label="Blueprint sections compiled so far"
    >
      {SECTIONS.map(({ key, label }) => {
        const ready = partial[key] !== undefined && partial[key] !== null;
        return (
          <span
            key={key}
            className={`streaming-chip ${ready ? 'streaming-chip--ready' : ''}`}
          >
            {ready ? '✓' : '○'} {label}
          </span>
        );
      })}
    </div>
  );
}
