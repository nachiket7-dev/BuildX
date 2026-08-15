/**
 * Strips reasoning-model tags, markdown code blocks, comments, and repairs
 * malformed or truncated JSON returned by LLM models.
 */

/**
 * Removes single-line (//) and multi-line (/* *\/) comments from JSON
 * while safely ignoring comment syntax inside quoted string literals.
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

    // Check for single-line comment //
    if (char === '/' && nextChar === '/') {
      while (i < str.length && str[i] !== '\n' && str[i] !== '\r') {
        i++;
      }
      if (i < str.length) {
        result += str[i]; // preserve newline
      }
      continue;
    }

    // Check for multi-line comment /* ... */
    if (char === '/' && nextChar === '*') {
      i += 2;
      while (i < str.length - 1 && !(str[i] === '*' && str[i + 1] === '/')) {
        i++;
      }
      i++; // skip trailing /
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Sanitizes raw LLM output to isolate the JSON payload and fix common formatting issues.
 */
function sanitizeJsonString(input: string): string {
  let s = input;

  // 1. Strip reasoning-model thinking tags
  s = s
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. Strip markdown code fences (```json ... ``` or ``` ...)
  s = s.replace(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g, '$1');
  s = s.replace(/^```[a-zA-Z0-9_-]*\s*/gm, '').replace(/```\s*$/gm, '');

  // 3. Find outermost JSON object { ... } or array [ ... ]
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let startIdx = -1;
  let isArray = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isArray = false;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isArray = true;
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

  // 4. Remove comments safely (preserving URLs/strings)
  s = removeJsonComments(s);

  // 5. Remove trailing commas before closing braces or brackets (e.g., ", }" -> "}")
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 6. Fix single-quoted keys and string values
  s = s
    .replace(/([{,]\s*)'([^'\n\r]+)'(\s*:)/g, '$1"$2"$3') // keys
    .replace(/:\s*'([^'\n\r]*)'/g, ': "$1"')              // object string values
    .replace(/(\[|,)\s*'([^'\n\r]*)'/g, '$1 "$2"');         // array string items

  return s.trim();
}

/**
 * Repairs truncated JSON strings by balancing open brackets/braces
 * and rolling back to the last valid comma checkpoint if needed.
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
      lastCommaCheckpoint = {
        length: result.length,
        stack: [...stack],
      };
    }

    result += char;

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  // Close open string literal
  let attempt = result;
  if (inString) {
    attempt += '"';
  }

  // Close open structures
  const tempStack = [...stack];
  while (tempStack.length > 0) {
    const last = tempStack.pop();
    if (last === '{') attempt += '}';
    else if (last === '[') attempt += ']';
  }

  // Remove trailing commas that might have been exposed before closing
  attempt = attempt.replace(/,\s*([}\]])/g, '$1');

  try {
    JSON.parse(attempt);
    return attempt;
  } catch {
    // If first attempt fails and we have a comma checkpoint, rollback
    if (lastCommaCheckpoint) {
      let rolledBack = result.slice(0, lastCommaCheckpoint.length);
      const cpStack = [...lastCommaCheckpoint.stack];
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

/**
 * Extracts and cleans JSON from raw LLM responses.
 */
export function extractJSON(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('No valid JSON string provided');
  }

  // Quick path: raw is already valid JSON
  try {
    const trimmed = raw.trim();
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Proceed to full sanitization
  }

  // Step 1: Sanitize markdown, comments, surrounding text, trailing commas
  let sanitized = sanitizeJsonString(raw);

  // Step 2: Test if sanitized is valid
  try {
    JSON.parse(sanitized);
    return sanitized;
  } catch {
    // Proceed to repair
  }

  // Step 3: Repair truncated brackets/braces/quotes
  const repaired = repairTruncatedJson(sanitized);

  // Step 4: Final trailing comma sweep
  const cleaned = repaired.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

/**
 * Parses JSON returned by an agent with multi-pass fallback repair.
 */
export function parseAgentJSON<T>(raw: string): T {
  // Pass 1: standard extract & parse
  try {
    const json = extractJSON(raw);
    return JSON.parse(json) as T;
  } catch (err1: any) {
    // Pass 2: aggressive cleanup (unescaped newlines inside strings, replace literal control characters)
    try {
      let aggressive = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```(?:json|JSON)?/g, '')
        .replace(/```/g, '');

      const start = Math.max(aggressive.indexOf('{'), aggressive.indexOf('['));
      if (start !== -1) {
        aggressive = aggressive.slice(start);
      }
      aggressive = removeJsonComments(aggressive);
      aggressive = aggressive.replace(/,\s*([}\]])/g, '$1');
      aggressive = repairTruncatedJson(aggressive);

      return JSON.parse(aggressive) as T;
    } catch (err2: any) {
      console.error('[parseAgentJSON Failed] Raw preview:', raw.slice(0, 300));
      throw new Error(`AI returned malformed JSON: ${err1.message}`);
    }
  }
}
