import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORIES, COMPONENT_KINDS, findKind } from './components.ts';

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
