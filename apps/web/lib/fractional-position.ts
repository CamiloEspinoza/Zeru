/**
 * Simple lexicographic fractional indexing for task positioning.
 * Mirrors the backend's generatePosition logic in tasks.service.ts.
 *
 * Returns a string that sorts alphabetically BETWEEN `before` and `after`.
 * If either is null, generates a position at the start or end.
 */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const MID_CHAR = "n";

export function positionBetween(before: string | null, after: string | null): string {
  if (!before && !after) return "a";
  if (!before) return prevPosition(after!);
  if (!after) return nextPosition(before);
  return midpoint(before, after);
}

function nextPosition(current: string): string {
  const lastChar = current[current.length - 1];
  const idx = ALPHABET.indexOf(lastChar);
  if (idx === -1 || idx === ALPHABET.length - 1) {
    return current + "n";
  }
  return current.slice(0, -1) + ALPHABET[idx + 1];
}

function prevPosition(current: string): string {
  const lastChar = current[current.length - 1];
  const idx = ALPHABET.indexOf(lastChar);
  if (idx <= 0) {
    return "0" + current;
  }
  return current.slice(0, -1) + ALPHABET[idx - 1];
}

function midpoint(before: string, after: string): string {
  if (before >= after) return before + MID_CHAR;

  const maxLen = Math.max(before.length, after.length);
  const padBefore = before.padEnd(maxLen, "a");
  const padAfter = after.padEnd(maxLen, "z");

  for (let i = 0; i < maxLen; i++) {
    const beforeChar = padBefore[i];
    const afterChar = padAfter[i];
    if (beforeChar === afterChar) continue;

    const beforeIdx = ALPHABET.indexOf(beforeChar);
    const afterIdx = ALPHABET.indexOf(afterChar);
    if (afterIdx - beforeIdx > 1) {
      const midIdx = Math.floor((beforeIdx + afterIdx) / 2);
      return padBefore.slice(0, i) + ALPHABET[midIdx];
    }
    return padBefore.slice(0, i + 1) + MID_CHAR;
  }

  return before + MID_CHAR;
}
