import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distance } from '../src/geometry.ts';
import {
  createRope,
  distanceToRope,
  stepRope,
  type Rope,
} from '../src/rope.ts';

function settle(rope: Rope, start = { x: 0, y: 0 }, end = { x: 200, y: 0 }) {
  for (let i = 0; i < 300; i++) stepRope(rope, start, end);
}

test('a new rope runs in a straight line between its ends', () => {
  const rope = createRope({ x: 0, y: 0 }, { x: 160, y: 0 });
  assert.ok(rope.points.every((point) => point.y === 0));
  assert.deepEqual(rope.points.at(0), { x: 0, y: 0 });
  assert.deepEqual(rope.points.at(-1), { x: 160, y: 0 });
});

test('the rope ends stay attached to the points it hangs from', () => {
  const rope = createRope({ x: 0, y: 0 }, { x: 200, y: 0 });
  settle(rope);
  assert.deepEqual(rope.points.at(0), { x: 0, y: 0 });
  assert.deepEqual(rope.points.at(-1), { x: 200, y: 0 });
});

test('a settled rope sags below the line between its ends', () => {
  const rope = createRope({ x: 0, y: 0 }, { x: 200, y: 0 });
  settle(rope);
  const middle = rope.points[Math.floor(rope.points.length / 2)];
  assert.ok(middle.y > 20, `expected a visible sag, got ${middle.y}`);
});

test('a rope follows its ends when they move', () => {
  const rope = createRope({ x: 0, y: 0 }, { x: 200, y: 0 });
  settle(rope);
  settle(rope, { x: 0, y: 0 }, { x: 600, y: 300 });
  assert.deepEqual(rope.points.at(-1), { x: 600, y: 300 });
  const longestSegment = Math.max(
    ...rope.points.slice(1).map((point, i) => distance(point, rope.points[i])),
  );
  assert.ok(longestSegment < 60, 'the rope should not be overstretched');
});

test('the distance to a rope is measured to its closest segment', () => {
  const rope = createRope({ x: 0, y: 0 }, { x: 200, y: 0 });
  assert.equal(distanceToRope(rope, { x: 100, y: 10 }), 10);
});
