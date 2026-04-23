import { Response } from 'express';

// ─── SSE helpers ───────────────────────────────────────────

/** Initialise SSE headers on the response */
export function initSSE(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });
  // Send a comment so proxies know the connection is alive
  res.write(':ok\n\n');
}

/** Send a typed SSE event */
export function sendSSE(
  res: Response,
  event: string,
  data: unknown
): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** End the SSE stream gracefully */
export function endSSE(res: Response): void {
  res.write('event: done\ndata: {}\n\n');
  res.end();
}

// ─── Partial JSON section detection ────────────────────────

const SECTION_KEYS = [
  'appName',
  'description',
  'targetUsers',
  'complexity',
  'features',
  'schema',
  'endpoints',
  'screens',
  'architecture',
  'code',
  'effort',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * Attempt to close an incomplete JSON buffer by adding missing brackets/braces,
 * then parse it. Returns a partial object if successful, null otherwise.
 */
export function tryParsePartial(
  buffer: string
): Record<string, unknown> | null {
  let attempt = buffer.trim();
  if (!attempt.startsWith('{')) return null;

  // Count unclosed braces and brackets
  let inString = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;

  for (const ch of attempt) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  // If we're inside a string, try truncating to the last complete value
  if (inString) {
    // Find the last unescaped quote before the end
    const lastQuote = attempt.lastIndexOf('"');
    if (lastQuote > 0) {
      attempt = attempt.slice(0, lastQuote + 1);
      // Recount
      inString = false;
      braces = 0;
      brackets = 0;
      for (const ch of attempt) {
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') braces++;
        else if (ch === '}') braces--;
        else if (ch === '[') brackets++;
        else if (ch === ']') brackets--;
      }
    }
  }

  // Close any open brackets then braces
  attempt += ']'.repeat(Math.max(0, brackets));
  attempt += '}'.repeat(Math.max(0, braces));

  // Remove trailing commas before closing braces/brackets
  attempt = attempt.replace(/,\s*([\]}])/g, '$1');

  try {
    const parsed = JSON.parse(attempt);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Compare two partial parse results and return the list of newly completed section keys.
 */
export function detectNewSections(
  prev: Record<string, unknown> | null,
  curr: Record<string, unknown> | null
): SectionKey[] {
  if (!curr) return [];
  const newSections: SectionKey[] = [];

  for (const key of SECTION_KEYS) {
    const hadBefore = prev && key in prev && prev[key] !== undefined;
    const hasNow = key in curr && curr[key] !== undefined;
    if (hasNow && !hadBefore) {
      newSections.push(key);
    }
  }

  return newSections;
}
