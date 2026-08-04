/**
 * Work-package numbers are stored inline in the item description as "(WP: 1234)".
 * Only digits round-trip: anything else parses back as null, so callers must
 * validate with `isValidWP` before writing.
 */
const WP_TAG = /\s*\(WP:\s*\d+\)/;
const WP_CAPTURE = /\(WP:\s*(\d+)\)/;

export const WP_PATTERN = /^\d+$/;

export function isValidWP(value: string): boolean {
  return WP_PATTERN.test(value);
}

export function parseWP(description: string): string | null {
  const match = description.match(WP_CAPTURE);
  return match ? match[1] : null;
}

export function stripWP(description: string): string {
  return description.replace(WP_TAG, '').trim();
}

export function setWP(description: string, wpNumber: string | null): string {
  const base = stripWP(description);
  return wpNumber ? `${base} (WP: ${wpNumber})` : base;
}
