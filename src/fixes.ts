import fixes from './fixes.json' with { type: 'json' };

/**
 * One thing to try when a component is too busy. It either works in one
 * click on the board (an action) or links to the board that teaches it.
 * Only fixes the board can show working are suggested.
 */
export interface Fix {
  title: string;
  why: string;
  action?: 'add-copy';
  /** A template or foundation id. */
  board?: string;
}

const FIXES = fixes as Record<string, Fix[]>;

/** What to try for a busy component of this kind, best first. */
export function fixesFor(kind: string): Fix[] {
  return FIXES[kind] ?? [];
}
