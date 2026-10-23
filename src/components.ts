import catalog from './components.json' with { type: 'json' };

export type Category =
  | 'external'
  | 'edge'
  | 'routing'
  | 'compute'
  | 'data'
  | 'async'
  | 'observability';

/** A small, concrete example of what the component holds or does. */
export type Sample =
  | { type: 'table'; caption: string; columns: string[]; rows: string[][] }
  | { type: 'code'; caption: string; language: string; code: string };

/** Plain-language explanation shown when a component is selected. */
export interface ComponentInfo {
  what: string;
  why: string;
  analogy: string;
  examples: string[];
  samples?: Sample[];
}

export interface ComponentKind {
  id: string;
  label: string;
  badge: string;
  category: Category;
  info: ComponentInfo;
}

export interface CategoryInfo {
  id: Category;
  label: string;
  color: string;
}

export const CATEGORIES = catalog.categories as CategoryInfo[];
// JSON can't express the Sample union, so the shape is asserted here and
// checked by components.test.ts.
export const COMPONENT_KINDS = catalog.components as ComponentKind[];

export function isKnownKind(id: string): boolean {
  return COMPONENT_KINDS.some((candidate) => candidate.id === id);
}

export function findKind(id: string): ComponentKind {
  const match = COMPONENT_KINDS.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Unknown component kind: ${id}`);
  return match;
}

export function categoryColor(category: Category): string {
  return CATEGORIES.find((candidate) => candidate.id === category)!.color;
}
