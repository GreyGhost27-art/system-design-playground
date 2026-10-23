import type { Template } from './templates.ts';

// Every JSON file in templates/ is a template; file names set the order.
const files = import.meta.glob<Template>('./templates/*.json', {
  eager: true,
  import: 'default',
});

export const TEMPLATES: Template[] = Object.keys(files)
  .sort()
  .map((path) => files[path]);
