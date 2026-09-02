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
export function extractFieldsFromBrokenJson(raw: string): Record<string, any> | null {
  try {
    const result: Record<string, any> = {};

    // Extract simple string fields: "plan": "...", "message": "..."
    const simpleFieldRe = /"(plan|message|diff)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = simpleFieldRe.exec(raw)) !== null) {
      result[m[1]] = m[2].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    // Extract loose plan if not quoted
    if (!result['plan']) {
      const loosePlan = raw.match(/"plan"\s*:\s*([^,}\]]+)/);
      if (loosePlan) {
        result['plan'] = loosePlan[1].trim().replace(/^['"`]|['"`]$/g, '');
      }
    }

    // Extract loose message if not quoted
    if (!result['message']) {
      const looseMsg = raw.match(/"message"\s*:\s*([^,}\]]+)/);
      if (looseMsg) {
        result['message'] = looseMsg[1].trim().replace(/^['"`]|['"`]$/g, '');
      }
    }

    // Extract files via boundary-aware extractor
    const extractedFiles = extractFilesFromBrokenJsonOrText(raw);
    if (extractedFiles.length > 0) {
      result['files'] = extractedFiles;
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
    // Proceed to boundary-aware extractor
  }

  return extractFilesFromBrokenJsonOrText(filesRaw);
}

/**
 * Universal Boundary-Aware File Extractor:
 * Extracts file objects from broken JSON, unescaped code strings, markdown code fences,
 * comments, or diff blocks without failing on internal quotes or newlines.
 */
export function extractFilesFromBrokenJsonOrText(
  raw: string,
  activeFilePath?: string,
  knownFilePaths: string[] = []
): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const seenPaths = new Set<string>();

  const addFile = (path: string, content: string, action: string = 'modify') => {
    if (!path || !content || typeof content !== 'string') return;
    const trimmed = content.trim();
    if (trimmed.length === 0) return;

    let cleanPath = path.trim().replace(/^['"`]|['"`]$/g, '').replace(/^[./\\]+/, '');

    // Normalize path with knownFilePaths if needed
    if (!cleanPath.startsWith('frontend/') && !cleanPath.startsWith('backend/')) {
      const match = knownFilePaths.find(
        (p) => p === cleanPath || p.endsWith(`/${cleanPath}`) || p.split('/').pop() === cleanPath
      );
      if (match) cleanPath = match;
    }

    if (!seenPaths.has(cleanPath)) {
      seenPaths.add(cleanPath);
      files.push({ path: cleanPath, content: trimmed, action });
    }
  };

  if (!raw || typeof raw !== 'string') return files;

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 1: Full JSON Parse via Sanitizer
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const directObj = JSON.parse(raw);
    if (directObj && Array.isArray(directObj.files)) {
      for (const f of directObj.files) {
        if (f && f.path && typeof f.content === 'string') {
          addFile(f.path, f.content, f.action || 'modify');
        }
      }
      if (files.length > 0) return files;
    }
  } catch {
    // Proceed to structural object scanner
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 2: Structural Object Scanner for "path" & "content"
  // ──────────────────────────────────────────────────────────────────────────
  // Find all file boundaries in the text by locating "path" occurrences
  const pathRegex = /"path"\s*:\s*["']([^"'\r\n]+)["']/g;
  const pathMatches: Array<{ path: string; index: number }> = [];
  let pm: RegExpExecArray | null;
  while ((pm = pathRegex.exec(raw)) !== null) {
    pathMatches.push({ path: pm[1], index: pm.index });
  }

  if (pathMatches.length > 0) {
    for (let i = 0; i < pathMatches.length; i++) {
      const current = pathMatches[i];
      const nextIndex = i + 1 < pathMatches.length ? pathMatches[i + 1].index : raw.length;

      // Look back slightly to catch the start of the object { if "content" is before "path"
      const searchStart = Math.max(0, current.index - 500);
      const segment = raw.slice(searchStart, nextIndex);

      // Look for "content"\s*:\s* inside this segment
      const contentIdx = segment.indexOf('"content"');
      if (contentIdx !== -1) {
        const afterContent = segment.slice(contentIdx + 9);
        const colonIdx = afterContent.indexOf(':');
        if (colonIdx !== -1) {
          let valuePart = afterContent.slice(colonIdx + 1).trim();

          // If valuePart starts with quote
          let rawContent = '';
          if (valuePart.startsWith('"')) {
            valuePart = valuePart.slice(1);

            // Look for end of string before action or closing brace
            const endMatch = valuePart.match(/([\s\S]*?)(?:"\s*,\s*"action"|"\s*\}\s*[,\]]|"\s*\}\s*$|"\s*,\s*\{|\s*\}\s*\]|\s*\}\s*$)/);
            if (endMatch && endMatch[1]) {
              rawContent = endMatch[1];
            } else {
              // Fallback: strip trailing closing quotes / braces
              rawContent = valuePart.replace(/"\s*\}\s*[,\]]?\s*$/g, '').replace(/"\s*$/g, '');
            }
          } else {
            // Unquoted or code-fenced content
            rawContent = valuePart.replace(/\s*\}\s*[,\]]?\s*$/g, '');
          }

          // Unescape content if it was JSON-escaped
          let cleanContent = rawContent;
          if (!cleanContent.includes('\n') && cleanContent.includes('\\n')) {
            cleanContent = cleanContent
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          } else {
            // Raw multiline string: still decode escaped quotes & slashes
            cleanContent = cleanContent
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }

          // Strip surrounding code fences if LLM wrapped content in them
          cleanContent = cleanContent.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '').replace(/\n?```\s*$/, '');

          if (cleanContent.trim().length > 0) {
            addFile(current.path, cleanContent);
          }
        }
      }
    }

    if (files.length > 0) return files;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 3: Markdown Code Fences with File Header or Comment
  // ──────────────────────────────────────────────────────────────────────────
  const fenceRegex = /(?:(?:###|##|#|\*\*|File:?|\/\/)\s*[`*]?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)[`*]?\s*\n\s*)?```(?:[a-zA-Z0-9_-]+)?(?:\s+(?:filepath:?|path:?|file:?)?\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+))?\s*(?:\n\s*(?:\/\/|\/\*|#)\s*(?:filepath:?|path:?|file:?)?\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)(?:\s*\*\/)?)?\n([\s\S]*?)```/g;
  let fm: RegExpExecArray | null;
  while ((fm = fenceRegex.exec(raw)) !== null) {
    const pathHeader = fm[1] || fm[2] || fm[3];
    const code = fm[4];
    if (pathHeader && code && code.trim().length > 0) {
      addFile(pathHeader, code);
    }
  }

  if (files.length > 0) return files;

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 4: Search/Replace Diff Blocks
  // ──────────────────────────────────────────────────────────────────────────
  if (raw.includes('<<<<<<< SEARCH') && raw.includes('>>>>>>> REPLACE')) {
    const target = activeFilePath || (knownFilePaths.length > 0 ? knownFilePaths[0] : 'frontend/src/App.tsx');
    addFile(target, raw);
    return files;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 5: Single Code Block Fallback
  // ──────────────────────────────────────────────────────────────────────────
  const singleBlock = raw.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  if (singleBlock && singleBlock[1] && singleBlock[1].trim().length > 0) {
    const target = activeFilePath || (knownFilePaths.length > 0 ? knownFilePaths[0] : 'frontend/src/App.tsx');
    addFile(target, singleBlock[1]);
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
      // Pass 3: Field-level resilient recovery for broken / truncated JSON
      try {
        const recovered: Record<string, any> = {};

        // Match string fields: "frontend", "backend", "sql", "appName", "description", etc.
        const stringKeys = [
          'frontend', 'backend', 'sql', 'erDiagram', 'archDiagram',
          'appName', 'description', 'targetUsers', 'complexity',
          'message', 'plan', 'diff', 'filePath', 'content', 'flow'
        ];

        // Boundary-aware string field extraction: handles unescaped JSX quotes and multiline blocks
        for (let idx = 0; idx < stringKeys.length; idx++) {
          const k = stringKeys[idx];
          const kMarker = `"${k}"`;
          const pos = raw.indexOf(kMarker);
          if (pos === -1) continue;

          const colonPos = raw.indexOf(':', pos + kMarker.length);
          if (colonPos === -1) continue;

          let afterColon = raw.slice(colonPos + 1).trim();
          if (afterColon.startsWith('"')) {
            afterColon = afterColon.slice(1);
          }

          // Search for next key boundary
          let endBoundary = afterColon.length;
          for (const otherKey of stringKeys) {
            if (otherKey === k) continue;
            const otherMarker = `"${otherKey}"`;
            const otherPos = afterColon.indexOf(otherMarker);
            if (otherPos !== -1 && otherPos < endBoundary) {
              const beforeOther = afterColon.slice(0, otherPos);
              const lastCommaOrQuote = Math.max(beforeOther.lastIndexOf(','), beforeOther.lastIndexOf('"'));
              if (lastCommaOrQuote !== -1) {
                endBoundary = lastCommaOrQuote;
              }
            }
          }

          let val = afterColon.slice(0, endBoundary).trim();
          val = val.replace(/"\s*\}\s*$/g, '').replace(/"\s*$/g, '');

          if (val.includes('\\n') && !val.includes('\n')) {
            val = val.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          } else {
            val = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }

          if (val.trim()) {
            recovered[k] = val.trim();
          }
        }

        // Check if schema, endpoints, screens, features, targetFiles arrays can be extracted
        const arrayKeys = ['schema', 'endpoints', 'screens', 'features', 'targetFiles', 'files'];
        for (const k of arrayKeys) {
          const arrIdx = raw.indexOf(`"${k}"`);
          if (arrIdx !== -1) {
            const bracketIdx = raw.indexOf('[', arrIdx);
            if (bracketIdx !== -1) {
              const arrSlice = raw.slice(bracketIdx);
              try {
                const repairedArr = extractJSON(arrSlice);
                recovered[k] = JSON.parse(repairedArr);
              } catch {
                // ignore
              }
            }
          }
        }

        if (Object.keys(recovered).length > 0) {
          console.warn(
            `[JSON Extract] Recovered ${Object.keys(recovered).length} fields from broken JSON: ${Object.keys(recovered).join(', ')}`
          );
          return recovered as T;
        }
      } catch {
        // Fall through
      }

      console.error('[parseAgentJSON Failed] Raw preview:', raw.slice(0, 400));
      throw new Error(`AI returned malformed JSON: ${err1.message}`);
    }
  }
}
