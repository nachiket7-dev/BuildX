/**
 * Strip reasoning-model blocks and extract the outermost JSON object from LLM output.
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
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No valid JSON object found in AI response');
  }
  return cleaned.slice(start, end + 1);
}

export function parseAgentJSON<T>(raw: string): T {
  const json = extractJSON(raw);
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error('AI returned malformed JSON. Please try again.');
  }
}
