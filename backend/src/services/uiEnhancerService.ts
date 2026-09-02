import type { Blueprint } from '../lib/types';
import { completeWithPipelineFallback } from '../lib/llm/router';
import { UI_GENERATOR_SYSTEM_PROMPT } from '../prompts/uiGenerator';
import {
  getBlueprintForUser,
  getBlueprintFiles,
  saveBlueprintFile,
} from '../lib/db';
import { getLanguageFromPath } from './vfsService';

export interface EnhanceUIResult {
  updatedFiles: Record<string, string>;
  modelUsed: string;
  usedFallback: boolean;
}

/**
 * Build the UI enhancement prompt with the existing blueprint context + current App.tsx
 */
function buildEnhanceUiPrompt(blueprint: Blueprint, existingAppCode: string): string {
  const appName = blueprint.appName ?? 'App';
  const description = blueprint.description ?? '';
  const schema = blueprint.schema ?? [];
  const endpoints = blueprint.endpoints ?? [];
  const screens = blueprint.screens ?? [];
  const features = blueprint.features;

  const schemaNames = schema.map((t: any) => t.table).join(', ');
  const endpointPaths = endpoints.slice(0, 8).map((e: any) => `${e.method} ${e.path}`).join(', ');
  const screenNames = screens.map((s: any) => s.name).join(', ');

  const coreFeatures = [
    ...(features?.authentication ?? []),
    ...(features?.core ?? []),
  ].slice(0, 6).join(', ');

  return `You are an expert React/Tailwind UI engineer upgrading a low-fidelity template to a rich production-quality dark glassmorphic interface.

APPLICATION CONTEXT:
- App Name: ${appName}
- Description: ${description}
- Domain Screens: ${screenNames || 'Dashboard, Users, Analytics, Settings'}
- Database Tables: ${schemaNames || 'users, records'}
- API Endpoints: ${endpointPaths || 'GET /api/v1/records, POST /api/v1/records'}
- Core Features: ${coreFeatures || 'User management, Data analytics, Reporting'}

EXISTING App.tsx (TO UPGRADE):
\`\`\`tsx
${existingAppCode.slice(0, 4000)}
\`\`\`

${UI_GENERATOR_SYSTEM_PROMPT}

TASK:
Replace the low-fidelity UI in App.tsx with a SINGLE, SELF-CONTAINED React component (no imports needed — use const { useState, useEffect } = React from global scope).

STRICT REQUIREMENTS:
1. Output ONLY the raw React component code — no markdown fences, no import statements, no export declarations.
2. Include ALL of the following in one component:
   - A sidebar nav with ${screenNames.split(',').slice(0, 4).join(', ') || 'Dashboard, Users, Analytics, Settings'} menu items
   - 4 KPI metric cards with realistic ${appName} domain data and % change badges (e.g., "+12.4% ↑")
   - A bar chart rendered using inline SVG with realistic data labels
   - A data table with 5 rows of domain-realistic mock data and Status badge pills
   - A recent activity timeline with timestamps and user avatars
3. Use ONLY Tailwind CSS classes for all styling (CDN version is loaded in the browser).
4. Seed all data with realistic domain-specific values matching the ${appName} business context.
5. Component name MUST be "App" so the preview engine can auto-mount it.

Output the upgraded App component now:`;
}

/**
 * Core UI Enhancement Service
 * Calls the LLM to upgrade the App.tsx in VFS with a rich, production-grade dark glassmorphic UI.
 */
export async function enhanceVfsUi(blueprintId: string, userId: string): Promise<EnhanceUIResult> {
  // 1. Load blueprint metadata
  const rawBlueprint = await getBlueprintForUser(blueprintId, userId, { incrementViews: false });
  if (!rawBlueprint) {
    throw new Error(`Blueprint ${blueprintId} not found or not owned by you`);
  }
  const blueprint: Blueprint = (rawBlueprint as any).parsedBlueprint || rawBlueprint;

  // 2. Load current VFS files to get existing App.tsx content
  const existingFiles = await getBlueprintFiles(blueprintId);
  const existingFileMap: Record<string, string> = {};
  for (const f of existingFiles) {
    existingFileMap[f.path] = f.content;
  }

  // Find the primary app file from priority list
  const priorityPaths = [
    'frontend/src/App.tsx',
    'src/App.tsx',
    'App.tsx',
    'frontend/src/App.jsx',
    'src/App.jsx',
  ];

  let appFilePath = priorityPaths.find(p => Boolean(existingFileMap[p]));
  const existingAppCode = appFilePath ? existingFileMap[appFilePath] : '';

  // Fall back to creating a new App.tsx if none found
  if (!appFilePath) {
    appFilePath = 'frontend/src/App.tsx';
  }

  // 3. Build LLM prompt
  const messages = [
    {
      role: 'user' as const,
      content: buildEnhanceUiPrompt(blueprint, existingAppCode),
    },
  ];

  // 4. Call the unified INGESTION pipeline (GLM 5.2 primary, Gemini fallback)
  const { text: enhancedCode, usedFallback, model: modelUsed } = await completeWithPipelineFallback(
    'INGESTION',
    messages,
    { maxTokens: 6000, temperature: 0.25 }
  );

  if (!enhancedCode || enhancedCode.trim().length < 100) {
    throw new Error('LLM returned empty or invalid UI enhancement code');
  }

  // Strip any accidental markdown fences that the model may have added
  const cleanedCode = enhancedCode
    .replace(/^```[a-z]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();

  // 5. Persist updated App.tsx back to the VFS database
  const language = getLanguageFromPath(appFilePath);
  await saveBlueprintFile(blueprintId, appFilePath, cleanedCode, language);

  // 6. Return updated file tree so the frontend can hot-reload
  const updatedFiles: Record<string, string> = {
    ...existingFileMap,
    [appFilePath]: cleanedCode,
  };

  console.log(`[UIEnhancer] Upgraded ${appFilePath} for blueprint ${blueprintId} via ${modelUsed} (fallback: ${usedFallback})`);

  return { updatedFiles, modelUsed, usedFallback };
}
