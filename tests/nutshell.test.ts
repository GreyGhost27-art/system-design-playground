import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import content from '../src/nutshell.json' with { type: 'json' };

const foundationsFolder = new URL(
  '../src/templates/foundations/',
  import.meta.url,
);
const foundationIds = readdirSync(foundationsFolder).map(
  (file) =>
    JSON.parse(readFileSync(new URL(file, foundationsFolder), 'utf8')).id,
);

test('every section of the nutshell has something to say', () => {
  assert.ok(content.title && content.lede);
  for (const section of content.sections) {
    const entries = [...(section.items ?? []), ...(section.map ?? [])];
    assert.ok(section.heading && entries.length > 0, section.heading);
  }
});

test('every signal links to a foundation that exists', () => {
  const signals = content.sections.flatMap((section) => section.map ?? []);
  assert.ok(signals.length > 0);
  for (const { signal, foundation } of signals) {
    assert.ok(foundationIds.includes(foundation), `${signal} → ${foundation}`);
  }
});
