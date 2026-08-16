import React, { useState } from 'react';
import { useVFS } from '../context/VFSContext';
import { LivePreview } from './LivePreview';
import type { LayoutParadigm, ProductArchetype, Blueprint } from '../lib/types';

type Viewport = 'desktop' | 'tablet' | 'mobile';

interface PreviewPanelProps {
  blueprintId: string;
  appName?: string;
  layoutParadigm?: LayoutParadigm;
  productArchetype?: ProductArchetype;
  primaryLandingScreenId?: string;
  blueprint?: Blueprint | null;
}

export function PreviewPanel({
  blueprintId,
  appName,
  layoutParadigm,
  productArchetype,
  primaryLandingScreenId,
  blueprint,
}: PreviewPanelProps) {
  const [viewport] = useState<Viewport>('desktop');
  const vfs = useVFS();

  return (
    <LivePreview
      blueprintId={blueprintId}
      appName={appName}
      viewport={viewport}
      files={vfs.files}
      activeFilePath={vfs.activeFilePath}
      layoutParadigm={layoutParadigm}
      productArchetype={productArchetype}
      primaryLandingScreenId={primaryLandingScreenId}
      blueprint={blueprint}
    />
  );
}

export default PreviewPanel;
