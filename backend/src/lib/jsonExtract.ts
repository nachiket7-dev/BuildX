/**
 * jsonExtract.ts
 *
 * Strips reasoning-model tags, markdown code fences, comments, and repairs
 * malformed or truncated JSON returned by LLM models — with specialized handling
 * for raw code strings, unescaped quotes, control characters, and broken files_raw.
 */

// ─── Comment Stripping ───────────────────────────────────────────────────────

/**
 * Removes single-line and multi-line JSON comments while safely skipping
 * over quoted string literals so comment chars inside strings are preserved.
 */
function removeJsonComments(str: string): string {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (inString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      while (i < str.length && str[i] !== '\n' && str[i] !== '\r') i++;
      if (i < str.length) result += str[i];
      continue;
    }

    if (char === '/' && nextChar === '*') {
      i += 2;
      while (i < str.length - 1 && !(str[i] === '*' && str[i + 1] === '/')) i++;
      i++;
      continue;
    }

    result += char;
  }

  return result;
}

// ─── Code-String Repair & Unescaped Quote Fixer ───────────────────────────────

/**
 * Walks JSON character-by-character tracking property key vs property value state.
 * Inside string values (especially embedded code), it:
 *   - Strips illegal ASCII control characters (\x00-\x1F except \t, \n, \r)
 *   - Converts raw unescaped newlines to \n and tabs to \t
 *   - Distinguishes structural closing quotes from internal unescaped quotes (e.g. JSX className="...")
 *   - Automatically escapes internal quotes as \"
 */
export function repairCodeStrings(raw: string): string {
  let s = raw;

  // 1. Strip illegal control characters
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const out: string[] = [];
  let inString = false;
  let isEscaped = false;
  let isKey = true;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inString) {
      if (isEscaped) {
        out.push(c);
        isEscaped = false;
        continue;
      }

      if (c === '\\') {
        out.push('\\');
        isEscaped = true;
        continue;
      }

      if (c === '"') {
        // Look ahead past whitespace to determine if this is a real structural closing quote
        let j = i + 1;
        while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\r' || s[j] === '\n')) j++;
        const nextChar = s[j];

        // If inside a key: closing quote MUST be followed by ':'
        if (isKey) {
          if (nextChar === ':') {
            inString = false;
            isKey = false;
            out.push('"');
            continue;
          } else {
            out.push('\\"');
            continue;
          }
        }

        // If inside a value: closing quote MUST be followed by ',', '}', ']', or end of text
        const isClosing = nextChar === ',' || nextChar === '}' || nextChar === ']' || j >= s.length;
        if (isClosing) {
          inString = false;
          isKey = true;
          out.push('"');
          continue;
        } else {
          // Embedded quote inside code/string value -> escape it
          out.push('\\"');
          continue;
        }
      }

      // Convert raw newlines and tabs inside strings
      if (c === '\n') {
        out.push('\\n');
        continue;
      }
      if (c === '\r') {
        if (s[i + 1] === '\n') i++;
        out.push('\\n');
        continue;
      }
      if (c === '\t') {
        out.push('\\t');
        continue;
      }

      out.push(c);
      continue;
    }

    // Outside string
    if (c === '"') {
      inString = true;
      out.push('"');
      continue;
    }

    if (c === ':') {
      isKey = false;
    } else if (c === ',' || c === '{' || c === '[') {
      isKey = true;
    }

    out.push(c);
  }

  if (inString) {
    out.push('"');
  }

  return out.join('');
}

// ─── Primary Sanitizer ───────────────────────────────────────────────────────

/**
 * Sanitizes raw LLM output to isolate the JSON payload and fix common issues.
 */
function sanitizeJsonString(input: string): string {
  let s = input;

  // 1. Strip reasoning-model thinking tags
  s = s
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. Strip markdown code fences (```json ... ``` or plain ```)
  s = s.replace(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g, '$1');
  s = s.replace(/^```[a-zA-Z0-9_-]*\s*/gm, '').replace(/```\s*$/gm, '');

  // 3. Find outermost JSON object { ... } or array [ ... ]
  const firstBrace   = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let startIdx = -1;
  let isArray  = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isArray  = false;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isArray  = true;
  }

  if (startIdx === -1) {
    throw new Error('No valid JSON object or array found in AI response');
  }

  const endChar = isArray ? ']' : '}';
  const lastIdx = s.lastIndexOf(endChar);
  if (lastIdx > startIdx) {
    s = s.substring(startIdx, lastIdx + 1);
  } else {
    s = s.substring(startIdx);
  }

  // 4. Remove comments safely (preserving URLs and strings)
  s = removeJsonComments(s);

  // 5. Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 6. Fix single-quoted keys and string values
  s = s
    .replace(/([{,]\s*)'([^'\n\r]+)'(\s*:)/g, '$1"$2"$3')  // keys
    .replace(/:\s*'([^'\n\r]*)'/g, ': "$1"')                // object string values
    .replace(/(\[|,)\s*'([^'\n\r]*)'/g, '$1 "$2"');          // array items

  return s.trim();
}

// ─── Truncation Repair ───────────────────────────────────────────────────────

/**
 * Repairs truncated JSON by balancing open brackets/braces and rolling back
 * to the last valid comma checkpoint when needed.
 */
function repairTruncatedJson(cleaned: string): string {
  let result = '';
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  let lastCommaCheckpoint: { length: number; stack: string[] } | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (char === ',' && !inString && !isEscaped) {
      lastCommaCheckpoint = { length: result.length, stack: [...stack] };
    }

    result += char;

    if (isEscaped) { isEscaped = false; continue; }
    if (char === '\\') { isEscaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }

    if (!inString) {
      if      (char === '{' || char === '[') stack.push(char);
      else if (char === '}' && stack[stack.length - 1] === '{') stack.pop();
      else if (char === ']' && stack[stack.length - 1] === '[') stack.pop();
    }
  }

  let attempt = result;
  if (inString) attempt += '"';
  const tempStack = [...stack];
  while (tempStack.length > 0) {
    const last = tempStack.pop();
    if (last === '{') attempt += '}';
    else if (last === '[') attempt += ']';
  }
  attempt = attempt.replace(/,\s*([}\]])/g, '$1');

  try {
    JSON.parse(attempt);
    return attempt;
  } catch {
    if (lastCommaCheckpoint) {
      let rolledBack = result.slice(0, lastCommaCheckpoint.length);
      const cpStack  = [...lastCommaCheckpoint.stack];
      while (cpStack.length > 0) {
        const last = cpStack.pop();
        if (last === '{') rolledBack += '}';
        else if (last === '[') rolledBack += ']';
      }
      rolledBack = rolledBack.replace(/,\s*([}\]])/g, '$1');
      try {
        JSON.parse(rolledBack);
        console.warn('[JSON Extract] Repaired truncated AI JSON via comma rollback.');
        return rolledBack;
      } catch {
        return attempt;
      }
    }
    return attempt;
  }
}

// ─── Field-Level Key Extractor & Fallback Parser ─────────────────────────────

export interface ExtractedFile {
  path: string;
  content: string;
  action?: string;
}

/**
 * Last-resort extraction: pull top-level string field values directly from
 * raw text using regexes that handle multi-line strings and raw arrays.
 */
export function extractFieldsFromBrokenJson(raw: string): Record<string, string> | null {
  try {
    const result: Record<string, string> = {};

    // Extract simple string fields: "plan": "...", "message": "..."
    const simpleFieldRe = /"(plan|message|diff)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = simpleFieldRe.exec(raw)) !== null) {
      result[m[1]] = m[2].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    // Extract "files" array as raw string
    const filesMatch = raw.match(/"files"\s*:\s*(\[[\s\S]*?\])\s*(?:,\s*"[a-zA-Z_]+"|\s*\})/);
    if (filesMatch) {
      result['files_raw'] = filesMatch[1];
    } else {
      const looseFilesMatch = raw.match(/"files"\s*:\s*(\[[\s\S]*)/);
      if (looseFilesMatch) {
        result['files_raw'] = looseFilesMatch[1];
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Reliably parses raw files_raw string or recovers file entries even if the array is broken.
 */
export function parseFilesRaw(filesRaw: string): ExtractedFile[] {
  if (!filesRaw || typeof filesRaw !== 'string') return [];

  // Try direct parse
  try {
    const parsed = JSON.parse(filesRaw);
    if (Array.isArray(parsed)) {
      return parsed.filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string');
    }
  } catch {
    // Proceed to repair
  }

  // Try extractJSON pass
  try {
    const cleaned = extractJSON(filesRaw);
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string');
    }
  } catch {
    // Proceed to regex recovery
  }

  return extractFilesFromBrokenJsonOrText(filesRaw);
}

/**
 * Universal fallback file extractor:
 * Extracts file objects from broken JSON, markdown code fences, comments, or diff blocks.
 */
export function extractFilesFromBrokenJsonOrText(
  raw: string,
  activeFilePath?: string,
  knownFilePaths: string[] = []
): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const seenPaths = new Set<string>();

  const addFile = (path: string, content: string, action: string = 'modify') => {
    if (!path || !content || content.trim().length === 0) return;
    const cleanPath = path.trim().replace(/^['"`]|['"`]$/g, '').replace(/^[./\\]+/, '');
    let finalPath = cleanPath;

    if (!finalPath.startsWith('frontend/') && !finalPath.startsWith('backend/')) {
      const match = knownFilePaths.find(
        (p) => p === finalPath || p.endsWith(`/${finalPath}`) || p.split('/').pop() === finalPath
      );
      if (match) {
        finalPath = match;
      }
    }

    if (!seenPaths.has(finalPath)) {
      seenPaths.add(finalPath);
      files.push({ path: finalPath, content: content.trim(), action });
    }
  };

  // Tier 1: JSON file objects with path and content keys
  const jsonFileRegex = /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)(?="\s*(?:,\s*"action"|\s*\}))\s*(?:,\s*"action"\s*:\s*"([^"]*)")?\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = jsonFileRegex.exec(raw)) !== null) {
    const filePath = m[1];
    let content = m[2];
    const action = m[3] || 'modify';
    content = content
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    addFile(filePath, content, action);
  }

  if (files.length > 0) return files;

  // Tier 2: Loose key matching for path and content
  const looseFileRegex = /"path"\s*:\s*"([^"\r\n]+)"[\s\S]*?"content"\s*:\s*("(?:[^"\\]|\\.)*")/g;
  while ((m = looseFileRegex.exec(raw)) !== null) {
    const filePath = m[1];
    try {
      const content = JSON.parse(m[2]);
      addFile(filePath, content, 'modify');
    } catch {
      const unescaped = m[2].slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      addFile(filePath, unescaped, 'modify');
    }
  }

  if (files.length > 0) return files;

  // Tier 3: Markdown code blocks with file path hints in comments or headers
  const mdCommentBlockRegex = /(?:(?:###|##|#|\*\*|File:?)\s*[`*]?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)[`*]?\s*\n\s*)?```(?:[a-zA-Z0-9_-]+)?(?:\s+(?:filepath:?|path:?|file:?)?\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+))?\s*(?:\n\s*(?:\/\/|\/\*|#)\s*(?:filepath:?|path:?|file:?)?\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)(?:\s*\*\/)?)?\n([\s\S]*?)```/g;
  while ((m = mdCommentBlockRegex.exec(raw)) !== null) {
    const pathHeader = m[1] || m[2] || m[3];
    const code = m[4];
    if (pathHeader && code && code.trim().length > 0) {
      addFile(pathHeader, code, 'modify');
    }
  }

  if (files.length > 0) return files;

  // Tier 4: Search/Replace diff blocks
  if (raw.includes('<<<<<<< SEARCH') && raw.includes('>>>>>>> REPLACE')) {
    if (activeFilePath) {
      addFile(activeFilePath, raw, 'modify');
      return files;
    }
    for (const kp of knownFilePaths) {
      const baseName = kp.split('/').pop()!;
      if (raw.includes(baseName) || raw.includes(kp)) {
        addFile(kp, raw, 'modify');
        return files;
      }
    }
    if (knownFilePaths.length > 0) {
      addFile(knownFilePaths[0], raw, 'modify');
      return files;
    }
  }

  // Tier 5: Single markdown code block fallback
  const singleCodeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/;
  const singleBlock = raw.match(singleCodeBlockRegex);
  if (singleBlock && singleBlock[1] && singleBlock[1].trim().length > 0) {
    const target = activeFilePath || (knownFilePaths.length > 0 ? knownFilePaths[0] : 'frontend/src/App.tsx');
    addFile(target, singleBlock[1], 'modify');
  }

  return files;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extracts and cleans JSON from raw LLM responses.
 * Multi-pass: sanitize → repair code strings → repair truncation.
 */
export function extractJSON(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('No valid JSON string provided');
  }

  // Quick path: already valid JSON
  try {
    const trimmed = raw.trim();
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Proceed to full sanitization
  }

  // Pass 1: sanitize markdown, comments, structural issues
  let sanitized = sanitizeJsonString(raw);

  try {
    JSON.parse(sanitized);
    return sanitized;
  } catch {
    // Proceed
  }

  // Pass 2: repair unescaped code strings (most common agent failure mode)
  const codeRepaired = repairCodeStrings(sanitized);
  const afterCommaClean = codeRepaired.replace(/,\s*([}\]])/g, '$1');

  try {
    JSON.parse(afterCommaClean);
    console.info('[JSON Extract] Repaired via code-string escape pass.');
    return afterCommaClean;
  } catch {
    // Proceed
  }

  // Pass 3: repair truncated brackets/braces
  const repaired = repairTruncatedJson(afterCommaClean);
  const cleaned  = repaired.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

/**
 * Parses JSON returned by an agent with multi-pass fallback repair.
 * Never throws unless all repair strategies are exhausted.
 */
export function parseAgentJSON<T>(raw: string): T {
  // Pass 1: standard extract & parse
  try {
    const json = extractJSON(raw);
    return JSON.parse(json) as T;
  } catch (err1: any) {
    // Pass 2: aggressive cleanup + code-string repair from scratch
    try {
      let aggressive = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```(?:json|JSON)?/g, '')
        .replace(/```/g, '');

      const start = Math.max(aggressive.indexOf('{'), aggressive.indexOf('['));
      if (start !== -1) aggressive = aggressive.slice(start);

      aggressive = removeJsonComments(aggressive);
      aggressive = aggressive.replace(/,\s*([}\]])/g, '$1');
      aggressive = repairCodeStrings(aggressive);
      aggressive = aggressive.replace(/,\s*([}\]])/g, '$1');
      aggressive = repairTruncatedJson(aggressive);

      return JSON.parse(aggressive) as T;
    } catch (err2: any) {
      console.error('[parseAgentJSON Failed] Raw preview:', raw.slice(0, 400));
      throw new Error(`AI returned malformed JSON: ${err1.message}`);
    }
  }
}
