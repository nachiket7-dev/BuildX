/**
 * Strip reasoning-model blocks and repair the JSON object if it got truncated due to token limits.
 */
export function extractJSON(raw: string): string {
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '');

  cleaned = cleaned
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();

  const start = cleaned.indexOf('{');
  if (start === -1) {
    throw new Error('No valid JSON object found in AI response');
  }
  cleaned = cleaned.slice(start);

  let result = '';
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  let lastCommaCheckpoint: { length: number; stack: string[] } | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    
    // Save checkpoint before modifying states (so we can rollback to before the comma)
    if (char === ',' && !inString && !isEscaped) {
      lastCommaCheckpoint = {
        length: result.length,
        stack: [...stack]
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

  // First attempt: close whatever is currently open
  let firstAttempt = result;
  if (inString) {
    firstAttempt += '"';
  }
  const tempStack = [...stack];
  while (tempStack.length > 0) {
    const last = tempStack.pop();
    if (last === '{') firstAttempt += '}';
    else if (last === '[') firstAttempt += ']';
  }

  try {
    JSON.parse(firstAttempt);
    return firstAttempt;
  } catch (err) {
    // If first attempt fails and we have a comma checkpoint, rollback to the comma
    if (lastCommaCheckpoint) {
      let rolledBack = result.slice(0, lastCommaCheckpoint.length);
      const cpStack = [...lastCommaCheckpoint.stack];
      while (cpStack.length > 0) {
        const last = cpStack.pop();
        if (last === '{') rolledBack += '}';
        else if (last === '[') rolledBack += ']';
      }
      try {
        JSON.parse(rolledBack);
        console.warn('[JSON Extract] Warning: AI JSON response was truncated. Successfully repaired via comma rollback.');
        return rolledBack;
      } catch (innerErr) {
        // Fallback to first attempt
        return firstAttempt;
      }
    }
    return firstAttempt;
  }
}

export function parseAgentJSON<T>(raw: string): T {
  const json = extractJSON(raw);
  try {
    return JSON.parse(json) as T;
  } catch (err: any) {
    throw new Error(`AI returned malformed JSON: ${err.message}`);
  }
}
