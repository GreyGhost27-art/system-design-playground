import {
  distance,
  distanceToSegment,
  lerp,
  type Point,
} from './geometry.ts';

const SEGMENTS = 16;
// Ropes are a little longer than the gap they span so they always sag.
const SLACK = 1.12;
const MIN_LENGTH = 40;
const GRAVITY = 0.6;
const DAMPING = 0.95;
const CONSTRAINT_ITERATIONS = 24;

export interface Rope {
  points: Point[];
  previous: Point[];
}

export function createRope(start: Point, end: Point): Rope {
  const points = Array.from({ length: SEGMENTS + 1 }, (_, i) =>
    lerp(start, end, i / SEGMENTS),
  );
  return { points, previous: points.map((point) => ({ ...point })) };
}

export function stepRope(rope: Rope, start: Point, end: Point): void {
  const { points, previous } = rope;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const point = points[i];
    const velocityX = (point.x - previous[i].x) * DAMPING;
    const velocityY = (point.y - previous[i].y) * DAMPING;
    previous[i] = { ...point };
    point.x += velocityX;
    point.y += velocityY + GRAVITY;
  }

  const ropeLength = Math.max(distance(start, end) * SLACK, MIN_LENGTH);
  const segmentLength = ropeLength / last;

  for (let n = 0; n < CONSTRAINT_ITERATIONS; n++) {
    Object.assign(points[0], start);
    Object.assign(points[last], end);
    for (let i = 0; i < last; i++) {
      keepApart(points[i], points[i + 1], segmentLength, {
        firstPinned: i === 0,
        secondPinned: i + 1 === last,
      });
    }
  }

  Object.assign(points[0], start);
  Object.assign(points[last], end);
}

export function distanceToRope(rope: Rope, point: Point): number {
  const { points } = rope;
  let nearest = Infinity;
  for (let i = 1; i < points.length; i++) {
    const segmentDistance = distanceToSegment(point, points[i - 1], points[i]);
    nearest = Math.min(nearest, segmentDistance);
  }
  return nearest;
}

function keepApart(
  a: Point,
  b: Point,
  length: number,
  pins: { firstPinned: boolean; secondPinned: boolean },
): void {
  const current = distance(a, b);
  if (current === 0) return;
  const correction = (current - length) / current;
  const dx = (b.x - a.x) * correction;
  const dy = (b.y - a.y) * correction;
  const aShare = pins.firstPinned ? 0 : pins.secondPinned ? 1 : 0.5;
  const bShare = pins.secondPinned ? 0 : 1 - aShare;
  a.x += dx * aShare;
  a.y += dy * aShare;
  b.x -= dx * bShare;
  b.y -= dy * bShare;
}
