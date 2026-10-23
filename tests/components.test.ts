import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { CATEGORIES, COMPONENT_KINDS, findKind } from '../src/components.ts';

const kindsIn = (category: string) =>
  COMPONENT_KINDS.filter((kind) => kind.category === category);

test('every component has a unique id and a known category', () => {
  const ids = COMPONENT_KINDS.map((kind) => kind.id);
  assert.equal(new Set(ids).size, ids.length);
  const categories = CATEGORIES.map((category) => category.id);
  for (const kind of COMPONENT_KINDS) {
    assert.ok(categories.includes(kind.category), kind.id);
  }
});

test('every component explains what it is, why and what it is like', () => {
  for (const { id, info } of COMPONENT_KINDS) {
    assert.ok(info.what.trim(), `${id} is missing "what"`);
    assert.ok(info.why.trim(), `${id} is missing "why"`);
    assert.ok(info.analogy.trim(), `${id} is missing "analogy"`);
  }
});

test('every component lists three well-known examples', () => {
  for (const { id, info } of COMPONENT_KINDS) {
    assert.equal(info.examples.length, 3, id);
    assert.equal(new Set(info.examples).size, 3, `${id} repeats an example`);
  }
});

test('an unknown component kind is reported by name', () => {
  assert.throws(
    () => findKind('mainframe'),
    /Unknown component kind: mainframe/,
  );
});

test('external, edge, routing, compute and data components show an example', () => {
  const kinds = ['external', 'edge', 'routing', 'compute', 'data'].flatMap(
    kindsIn,
  );
  for (const { id, info } of kinds) {
    assert.ok((info.samples ?? []).length > 0, `${id} has no samples`);
  }
});

test('every example is a captioned table or code snippet', () => {
  for (const { id, info } of COMPONENT_KINDS) {
    for (const sample of info.samples ?? []) {
      assert.ok(sample.caption.trim(), `${id} has a sample without caption`);
      if (sample.type === 'table') {
        for (const row of sample.rows) {
          assert.equal(row.length, sample.columns.length, `${id}: ${row}`);
        }
      } else {
        assert.equal(sample.type, 'code', `${id} has an unknown sample type`);
        assert.ok(sample.language && sample.code.trim(), id);
      }
    }
  }
});

test('code examples fit the drawer, 40 characters per line at most', () => {
  for (const { id, info } of COMPONENT_KINDS) {
    for (const sample of info.samples ?? []) {
      if (sample.type !== 'code') continue;
      for (const line of sample.code.split('\n')) {
        assert.ok(line.length <= 40, `${id}: "${line}" is too long`);
      }
    }
  }
});

const componentsFolder = new URL('../src/components/', import.meta.url);

/** Every `<category>/<id>.json` file under src/components. */
function componentFilesOnDisk(): { category: string; id: string }[] {
  return readdirSync(componentsFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((folder) =>
      readdirSync(new URL(`${folder.name}/`, componentsFolder))
        .filter((file) => file.endsWith('.json'))
        .map((file) => ({ category: folder.name, id: file.slice(0, -5) })),
    );
}

test('every component file is listed in components/index.ts', () => {
  const listed = COMPONENT_KINDS.map((kind) => kind.id).sort();
  const onDisk = componentFilesOnDisk()
    .map((file) => file.id)
    .sort();
  assert.deepEqual(listed, onDisk);
});

test('each component file is named after its id, in its category folder', () => {
  for (const { category, id } of componentFilesOnDisk()) {
    const kind = findKind(id);
    assert.equal(kind.category, category, `${id}.json is in ${category}/`);
  }
});
