import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PromptTemplate } from './types';

const PROMPTS_DIR = join(__dirname, 'prompts');

/** Load a prompt template by key. Key must be a simple filename (no slashes, no ..). */
export function loadPrompt(key: string): PromptTemplate {
  if (key.includes('/') || key.includes('\\') || key.includes('..')) {
    throw new Error(`Invalid prompt key: "${key}"`);
  }
  const path = join(PROMPTS_DIR, `${key}.md`);
  let body: string;
  try {
    body = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Prompt file not found: ${path}`);
  }
  return { key, body };
}

/** Render a prompt by replacing {{var}} placeholders with values from `vars`.
 *  - Unknown placeholders are left intact and a console.warn is emitted (dev aid).
 *  - Values are inserted literally; the output is not re-scanned, so a value
 *    containing "{{foo}}" will NOT be re-interpolated. */
export function renderPrompt(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return vars[name];
    }
    console.warn(`Unresolved placeholder: {{${name}}}`);
    return match;
  });
}
