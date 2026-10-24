import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWheelPlacement, radialSlices } from '../src/radialMenu.ts';

const CENTER = 124;

test('a few slices fan out over the top half, left to right', () => {
  const slices = radialSlices(3);
  assert.equal(slices.length, 3);
  const [left, middle, right] = slices.map((slice) => slice.center);
  assert.ok(left.x < middle.x && middle.x < right.x);
  for (const { y } of [left, middle, right]) assert.ok(y < CENTER);
});

test('the fan is symmetric around the top', () => {
  const [left, middle, right] = radialSlices(3).map((slice) => slice.center);
  assert.ok(Math.abs(middle.x - CENTER) < 0.001);
  assert.ok(Math.abs(CENTER - left.x - (right.x - CENTER)) < 0.001);
  assert.ok(Math.abs(left.y - right.y) < 0.001);
});

test('many slices widen the fan instead of getting too thin', () => {
  const slices = radialSlices(5);
  const [first, second] = slices.map((slice) => slice.center);
  const angle = (point: { x: number; y: number }) =>
    Math.atan2(CENTER - point.y, point.x - CENTER);
  const sliceAngle = angle(second) - angle(first);
  assert.ok(Math.abs(Math.abs(sliceAngle) - (40 * Math.PI) / 180) < 0.001);
});

test('every slice is a closed shape made of two arcs', () => {
  for (const { path } of radialSlices(4)) {
    assert.match(path, /^M .+ A .+ L .+ A .+ Z$/);
  }
});

test('a wheel opens at its target when the press is well below it', () => {
  const place = createWheelPlacement(3);
  const target = { x: 100, y: 100 };
  assert.deepEqual(place('a', target, { x: 100, y: 300 }), target);
});

test('a wheel is lifted so it opens above the press', () => {
  const place = createWheelPlacement(3);
  const center = place('a', { x: 100, y: 100 }, { x: 120, y: 100 });
  assert.deepEqual(center, { x: 100, y: 84 });
});

test('a wide fan is lifted further, as it reaches below its centre', () => {
  const narrow = createWheelPlacement(3)('a', { x: 0, y: 0 }, { x: 0, y: 0 });
  const wide = createWheelPlacement(5)('a', { x: 0, y: 0 }, { x: 0, y: 0 });
  assert.ok(wide.y < narrow.y);
});

test('pressing a slice of an open wheel does not move it', () => {
  const place = createWheelPlacement(3);
  const target = { x: 100, y: 100 };
  const opened = place('a', target, { x: 100, y: 300 });
  assert.deepEqual(place('a', target, { x: 100, y: 40 }), opened);
});

test('a wheel reopened for something else is placed afresh', () => {
  const place = createWheelPlacement(3);
  const target = { x: 100, y: 100 };
  place('a', target, null);
  assert.equal(place('b', target, { x: 100, y: 100 }).y, 84);
});
