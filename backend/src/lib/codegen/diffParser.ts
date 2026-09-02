/**
 * diffParser.ts — Search/Replace Diff Engine
 *
 * Parses and applies strict <<<<<<< SEARCH / ======= / >>>>>>> REPLACE diff blocks
 * as produced by the DIFF_PATCH_MODE prompt in prompts.ts.
 *
 * Design principles:
 * - Whitespace-tolerant matching: trailing spaces, mixed CRLF/LF, and leading blank
 *   lines do not cause patch failures.
 * - Indentation-safe: if the SEARCH block is found but with a consistent indentation
 *   offset, the REPLACE block is re-indented to match.
 * - Partial-match fallback: if exact match fails, attempt normalized whitespace match
 *   before reporting an error.
 * - Idempotent: applying the same patch twice returns the already-patched content
 *   without error (detects that SEARCH is absent but REPLACE is already present).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiffBlock {
  search: string;
  replace: string;
}

export interface ApplyResult {
  code: string;
  /** Number of blocks successfully applied */
  applied: number;
  /** Blocks that could not be matched (logged as warnings, not thrown) */
  failed: DiffBlock[];
  /** True when the model returned "NO_CHANGE" */
  noChange: boolean;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

const SEARCH_MARKER  = '<<<<<<< SEARCH';
const SEP_MARKER     = '=======';
const REPLACE_MARKER = '>>>>>>> REPLACE';
const NO_CHANGE_TOKEN = 'NO_CHANGE';

/**
 * Parse the raw model output into an array of DiffBlock objects.
 *
 * Handles:
 * - Multiple blocks in a single response
 * - Trailing whitespace on marker lines
 * - Blocks embedded inside markdown fences (strips the fence wrapper)
 */
export function parseDiffBlocks(rawOutput: string): DiffBlock[] | 'NO_CHANGE' {
  // Strip <think>...</think> reasoning blocks some models emit
  const cleaned = rawOutput
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  if (cleaned === NO_CHANGE_TOKEN || cleaned.toUpperCase().includes(NO_CHANGE_TOKEN)) {
    return 'NO_CHANGE';
  }

  // Strip outer markdown fences that some models wrap around the entire response
  const unwrapped = cleaned
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const blocks: DiffBlock[] = [];
  const lines = unwrapped.split('\n');

  let i = 0;
  while (i < lines.length) {
    // Find next SEARCH marker
    if (lines[i].trimEnd() === SEARCH_MARKER) {
      const searchLines: string[] = [];
      i++;
      // Collect lines until SEP_MARKER
      while (i < lines.length && lines[i].trimEnd() !== SEP_MARKER) {
        searchLines.push(lines[i]);
        i++;
      }
      if (i >= lines.length) break; // malformed — no separator

      const replaceLines: string[] = [];
      i++; // skip '======='
      // Collect lines until REPLACE_MARKER
      while (i < lines.length && lines[i].trimEnd() !== REPLACE_MARKER) {
        replaceLines.push(lines[i]);
        i++;
      }
      i++; // skip '>>>>>>> REPLACE'

      const search  = searchLines.join('\n');
      const replace = replaceLines.join('\n');

      if (search.trim().length > 0) {
        blocks.push({ search, replace });
      }
    } else {
      i++;
    }
  }

  // ── Fallback: Parse standard unified diff hunks (--- a/ +++ b/ @@ format) ──
  if (blocks.length === 0) {
    const unifiedBlocks = parseUnifiedDiffHunks(unwrapped);
    if (unifiedBlocks.length > 0) return unifiedBlocks;
  }

  return blocks;
}

/**
 * Parse unified diff format (git diff) into DiffBlock objects.
 * Handles output like:
 *   --- a/path/to/file
 *   +++ b/path/to/file
 *   @@ -10,5 +10,6 @@
 *   context line
 *   -removed line
 *   +added line
 */
function parseUnifiedDiffHunks(text: string): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  const hunkRegex = /@@\s*-\d+(?:,\d+)?\s*\+\d+(?:,\d+)?\s*@@[^\n]*/g;
  let match: RegExpExecArray | null;
  const positions: number[] = [];

  while ((match = hunkRegex.exec(text)) !== null) {
    positions.push(match.index + match[0].length);
  }

  if (positions.length === 0) return blocks;

  for (let p = 0; p < positions.length; p++) {
    const start = positions[p];
    const end = p + 1 < positions.length
      ? text.lastIndexOf('@@', positions[p + 1])
      : text.length;
    const hunkBody = text.slice(start, end).trim();
    const lines = hunkBody.split('\n');

    const searchLines: string[] = [];
    const replaceLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('-')) {
        searchLines.push(line.slice(1));
      } else if (line.startsWith('+')) {
        replaceLines.push(line.slice(1));
      } else if (line.startsWith(' ') || line === '') {
        // Context line — appears in both
        const ctx = line.startsWith(' ') ? line.slice(1) : line;
        searchLines.push(ctx);
        replaceLines.push(ctx);
      }
    }

    if (searchLines.length > 0) {
      blocks.push({
        search: searchLines.join('\n'),
        replace: replaceLines.join('\n'),
      });
    }
  }

  return blocks;
}

// ─── Normalisation helpers ───────────────────────────────────────────────────

/**
 * Replace all unicode non-breaking spaces and exotic space characters with standard ASCII spaces,
 * and normalize CRLF/CR to Unix LF.
 */
export function sanitizeUnicodeWhitespace(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/** Normalize line endings, replace non-breaking spaces, and strip trailing whitespace per line */
export function normalizeLines(text: string): string {
  return sanitizeUnicodeWhitespace(text)
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n');
}

/**
 * Detect whether `needle` appears inside `haystack` with a consistent
 * leading-whitespace offset on every line. Returns the offset string or null.
 */
function detectIndentOffset(haystack: string, needle: string): string | null {
  const needleLines  = needle.split('\n');
  const haystackLines = haystack.split('\n');

  if (needleLines.length === 0) return null;

  const firstNeedle = needleLines[0].trimStart();
  if (!firstNeedle) return null;

  for (let hi = 0; hi <= haystackLines.length - needleLines.length; hi++) {
    const haystackLine = haystackLines[hi];
    if (!haystackLine.trimStart().startsWith(firstNeedle.slice(0, 10))) continue;

    // Possible match start — measure indent offset
    const haystackIndent = haystackLine.length - haystackLine.trimStart().length;
    const needleIndent   = needleLines[0].length - needleLines[0].trimStart().length;
    const offset = haystackIndent - needleIndent;
    if (offset < 0) continue; // haystack less indented than needle — skip

    const offsetStr = ' '.repeat(offset);

    // Verify all lines match with this offset
    let allMatch = true;
    for (let ni = 0; ni < needleLines.length; ni++) {
      const expected = offsetStr + needleLines[ni];
      if (haystackLines[hi + ni] !== expected) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return offsetStr;
  }

  return null;
}

/**
 * Re-indent `replaceText` by prepending `offsetStr` to every non-empty line.
 */
function applyIndentOffset(replaceText: string, offsetStr: string): string {
  if (!offsetStr) return replaceText;
  return replaceText
    .split('\n')
    .map(line => (line.trim() ? offsetStr + line : line))
    .join('\n');
}

// ─── Core Apply Function ─────────────────────────────────────────────────────

/**
 * Apply a single DiffBlock to `originalCode`.
 *
 * Matching strategy (in order):
 * 1. Exact string match (fastest, most reliable).
 * 2. Sanitized unicode whitespace match (\u00a0 -> \u0020, CRLF -> LF).
 * 3. Normalized line match (trim trailing whitespace).
 * 4. Indent-offset match (SEARCH has consistent extra/fewer indent than file).
 * 5. Fuzzy trimmed line matching (compare lines with .trim() applied to ignore indentation).
 *
 * Returns null if the block cannot be matched (caller decides how to handle).
 */
function applySingleBlock(originalCode: string, block: DiffBlock): string | null {
  const search = sanitizeUnicodeWhitespace(block.search);
  const replace = sanitizeUnicodeWhitespace(block.replace);
  const sanitizedCode = sanitizeUnicodeWhitespace(originalCode);

  // ── Strategy 1: Exact match ──────────────────────────────────────────────
  if (sanitizedCode.includes(search)) {
    return sanitizedCode.replace(search, replace);
  }

  // ── Strategy 2: Normalized whitespace match ──────────────────────────────
  const normCode   = normalizeLines(sanitizedCode);
  const normSearch = normalizeLines(search);
  const normReplace = normalizeLines(replace);

  if (normCode.includes(normSearch)) {
    return normCode.replace(normSearch, normReplace);
  }

  // ── Strategy 3: Indent-offset match ─────────────────────────────────────
  const offsetStr = detectIndentOffset(normCode, normSearch);
  if (offsetStr !== null) {
    const indentedSearch  = normSearch.split('\n').map(l => offsetStr + l).join('\n');
    const indentedReplace = applyIndentOffset(normReplace, offsetStr);
    if (normCode.includes(indentedSearch)) {
      return normCode.replace(indentedSearch, indentedReplace);
    }
  }

  // ── Strategy 4: Fuzzy trimmed line-by-line matching ──────────────────────
  const fuzzyResult = fuzzyLineMatch(sanitizedCode, search, replace);
  if (fuzzyResult !== null) return fuzzyResult;

  // ── Idempotency check ────────────────────────────────────────────────────
  // If the REPLACE content is already present, treat as a no-op success
  const normReplaceCheck = normalizeLines(replace);
  if (normReplaceCheck.trim() && normCode.includes(normReplaceCheck)) {
    console.warn('[diffParser] Block already applied (idempotent skip):', search.slice(0, 60));
    return sanitizedCode; // already patched
  }

  return null; // could not match
}

/**
 * Strategy 4: Fuzzy line-by-line match with .trim() applied.
 * Compares lines after trimming leading/trailing indentation and compressing inner whitespace.
 * If the stripped lines match a contiguous region in the file, substitutes the region with
 * the replacement.
 */
function fuzzyLineMatch(originalCode: string, search: string, replace: string): string | null {
  const sanitizeLine = (s: string) => sanitizeUnicodeWhitespace(s).replace(/\s+/g, ' ').trim();
  const origLines = sanitizeUnicodeWhitespace(originalCode).split('\n');
  const searchLines = sanitizeUnicodeWhitespace(search)
    .split('\n')
    .filter(l => l.trim().length > 0);

  if (searchLines.length === 0) return null;

  const sanitizedSearch = searchLines.map(sanitizeLine);

  for (let i = 0; i <= origLines.length - searchLines.length; i++) {
    let allMatch = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (sanitizeLine(origLines[i + j]) !== sanitizedSearch[j]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      const before = origLines.slice(0, i);
      const after = origLines.slice(i + searchLines.length);
      const replaceLines = sanitizeUnicodeWhitespace(replace).split('\n');
      console.info(`[diffParser] Fuzzy trimmed match succeeded at line ${i + 1} for ${searchLines.length} line(s)`);
      return [...before, ...replaceLines, ...after].join('\n');
    }
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse raw model output and apply all Search/Replace blocks to `originalCode`.
 *
 * @param originalCode - The current full source code of the file
 * @param rawModelOutput - The raw string returned by the LLM in DIFF_PATCH_MODE
 * @returns ApplyResult with patched code, counts, and any unmatched blocks
 */
export function applySearchReplace(
  originalCode: string,
  rawModelOutput: string
): ApplyResult {
  const parsed = parseDiffBlocks(rawModelOutput);

  if (parsed === 'NO_CHANGE') {
    return { code: originalCode, applied: 0, failed: [], noChange: true };
  }

  if (parsed.length === 0) {
    console.warn('[diffParser] No diff blocks found in model output. Raw output length:', rawModelOutput.length);
    return { code: originalCode, applied: 0, failed: [], noChange: false };
  }

  let code = originalCode;
  let applied = 0;
  const failed: DiffBlock[] = [];

  for (const block of parsed) {
    const result = applySingleBlock(code, block);
    if (result !== null) {
      code = result;
      applied++;
    } else {
      console.warn(
        '[diffParser] Failed to match SEARCH block:',
        JSON.stringify(block.search.slice(0, 120))
      );
      failed.push(block);
    }
  }

  return { code, applied, failed, noChange: false };
}

/**
 * Convenience wrapper: apply and throw if ANY block failed to match.
 * Use this in strict pipelines where partial application is unacceptable.
 */
export function applySearchReplaceStrict(
  originalCode: string,
  rawModelOutput: string
): string {
  const result = applySearchReplace(originalCode, rawModelOutput);

  if (result.noChange) return originalCode;

  if (result.failed.length > 0) {
    const summary = result.failed
      .map((b, i) => `  Block ${i + 1}: SEARCH="${b.search.slice(0, 80).replace(/\n/g, '\\n')}..."`)
      .join('\n');
    throw new Error(
      `[diffParser] ${result.failed.length} of ${result.applied + result.failed.length} diff block(s) could not be matched:\n${summary}`
    );
  }

  return result.code;
}
