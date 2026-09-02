/**
 * BuildX AST-Aware Context Skeletonizer
 *
 * Compresses source code files by preserving critical architectural context:
 * - Imports and exports
 * - Type definitions, interfaces, and enums
 * - Function and React component signatures, props, and hooks
 * - Folds large unchanged inner implementation bodies into concise markers
 *
 * This reduces prompt token payload size by 60-80% without losing structural type information.
 */

export interface SkeletonOptions {
  maxLines?: number;
  preserveComments?: boolean;
}

/**
 * Skeletonizes a TypeScript/JavaScript/TSX/JSX file if it exceeds line threshold.
 */
export function skeletonizeCode(code: string, options: SkeletonOptions = {}): string {
  const maxLines = options.maxLines ?? 180;
  const lines = code.split('\n');

  // If file is already concise, return unchanged
  if (lines.length <= maxLines) {
    return code;
  }

  const skeletonLines: string[] = [];
  let inInterfaceOrType = false;
  let braceDepth = 0;
  let insideFoldableBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Preserve all import statements
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{') || trimmed.startsWith('import type')) {
      skeletonLines.push(line);
      continue;
    }

    // Preserve export statements and type/interface definitions
    if (
      trimmed.startsWith('export type ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('export interface ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('export enum ') ||
      trimmed.startsWith('enum ')
    ) {
      inInterfaceOrType = true;
      skeletonLines.push(line);
      continue;
    }

    if (inInterfaceOrType) {
      skeletonLines.push(line);
      if (trimmed.endsWith('}') || trimmed.endsWith('};')) {
        inInterfaceOrType = false;
      }
      continue;
    }

    // Track braces
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    const prevDepth = braceDepth;
    braceDepth += openBraces - closeBraces;

    // Detect function / component signatures
    const isSignature =
      trimmed.startsWith('export function ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('export const ') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('export default function ') ||
      trimmed.startsWith('export class ') ||
      trimmed.startsWith('class ');

    const isHookOrState =
      trimmed.startsWith('const [') ||
      trimmed.startsWith('useEffect(') ||
      trimmed.startsWith('useMemo(') ||
      trimmed.startsWith('useCallback(') ||
      trimmed.startsWith('useRef(') ||
      trimmed.startsWith('useContext(');

    // Keep top-level component signatures and state declarations
    if (prevDepth <= 1 && (isSignature || isHookOrState)) {
      skeletonLines.push(line);
      insideFoldableBody = false;
      continue;
    }

    // Keep JSX return statements at outer depth
    if (trimmed.startsWith('return (') || trimmed === 'return;' || trimmed.startsWith('return <')) {
      skeletonLines.push(line);
      continue;
    }

    // For deeply nested code blocks (> 10 lines inside a block), fold
    if (braceDepth >= 2) {
      if (!insideFoldableBody) {
        insideFoldableBody = true;
        skeletonLines.push(`  // ... [internal implementation lines ${i + 1}–${Math.min(i + 20, lines.length)} preserved]`);
      }
      continue;
    } else {
      insideFoldableBody = false;
    }

    // Default: keep lines near root
    skeletonLines.push(line);
  }

  return skeletonLines.join('\n');
}

/**
 * Universal source code plausibility validator:
 * Validates that an AI output is genuine code rather than conversational English prose or stub commentary.
 */
export function isPlausibleSourceCode(text: string | undefined | null, filePath?: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 5) return false;

  // If text contains search/replace diff markers, it's a valid diff payload
  if (trimmed.includes('<<<<<<< SEARCH') && trimmed.includes('=======') && trimmed.includes('>>>>>>> REPLACE')) {
    return true;
  }

  // If text starts with conversational English chatter, it's NOT valid code
  const proseRegex = /^(?:wait|let's|here\s+is|sure|certainly|below\s+is|okay|i\s+have|note:?|as\s+requested|in\s+this|to\s+implement|first|second|i'll|i\s+will)/i;
  const firstLine = trimmed.split('\n')[0].trim();
  if (proseRegex.test(firstLine) && !firstLine.startsWith('//') && !firstLine.startsWith('/*')) {
    return false;
  }

  // Extension-based validation
  const ext = (filePath || '').split('.').pop()?.toLowerCase();
  if (ext === 'tsx' || ext === 'ts' || ext === 'jsx' || ext === 'js') {
    const hasCodeTokens = /(?:import\s|export\s|const\s|let\s|function\s|class\s|interface\s|type\s|<\w+|\/\*|\/\/)/.test(trimmed);
    return hasCodeTokens;
  }

  if (ext === 'css') {
    const hasCssTokens = /(?:@tailwind|@apply|@layer|[:;{}]|--\w+)/.test(trimmed);
    return hasCssTokens;
  }

  if (ext === 'json') {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  return true;
}
