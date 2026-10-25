import type { Point } from '../model/geometry.ts';

// Ring sizes, in pixels: the hole in the middle and the outer edge.
const INNER = 44;
const OUTER = 124;
// Space between neighbouring slices, in pixels.
const GAP = 3;
// Narrowest slice, so short labels still fit.
const MIN_SLICE = (40 * Math.PI) / 180;
// Clear space between a wheel and the press that opened it.
const PRESS_CLEARANCE = 16;

export interface Slice {
  /** SVG path of the slice, in a square of side 2 × OUTER. */
  path: string;
  /** Where the slice's icon and label sit, in the same square. */
  center: Point;
}

/**
 * Slices of a ring fanned out above its centre, left to right. A few
 * slices share the top half; more slices widen the fan instead of
 * shrinking below MIN_SLICE.
 */
export function radialSlices(count: number): Slice[] {
  const slice = sliceAngle(count);
  const leftmost = Math.PI / 2 + (slice * count) / 2;
  return Array.from({ length: count }, (_, i) => {
    const from = leftmost - i * slice;
    const to = from - slice;
    const middle = (from + to) / 2;
    return {
      path: slicePath(from, to),
      center: pointAt(middle, (INNER + OUTER) / 2),
    };
  });
}

/**
 * Places a wheel at its target, lifted when needed so the whole fan opens
 * above the press (pointer or finger) that opened it: letting go, or
 * tapping again, must never land on a slice by accident. The lift is
 * decided when the wheel opens, so pressing a slice never makes it jump.
 * Positions are in screen pixels; pass `key: null` while it is hidden.
 */
export function createWheelPlacement(count: number) {
  let openFor: string | null = null;
  let lift = 0;
  return (key: string | null, target: Point, press: Point | null): Point => {
    if (key !== openFor) {
      openFor = key;
      const highestSafe = press
        ? press.y - depthBelowCenter(count) - PRESS_CLEARANCE
        : Infinity;
      lift = Math.max(0, target.y - highestSafe);
    }
    return { x: target.x, y: target.y - lift };
  };
}

/** How far a wide fan reaches below its centre. */
function depthBelowCenter(count: number): number {
  const overHalf = sliceAngle(count) * count - Math.PI;
  return overHalf > 0 ? OUTER * Math.sin(overHalf / 2) : 0;
}

function sliceAngle(count: number): number {
  return Math.max(Math.PI / count, MIN_SLICE);
}

/** Cuts each button of `menu` into its slice of the wheel. */
export function layoutRadialMenu(menu: HTMLElement): void {
  menu.style.width = menu.style.height = `${OUTER * 2}px`;
  // Hidden buttons (options that don't apply here) take no slice.
  const buttons = [
    ...menu.querySelectorAll<HTMLElement>(':scope > button:not([hidden])'),
  ];
  radialSlices(buttons.length).forEach(({ path, center }, i) => {
    buttons[i].style.clipPath = `path('${path}')`;
    buttons[i].style.setProperty('--x', `${center.x}px`);
    buttons[i].style.setProperty('--y', `${center.y}px`);
  });
}

/** Angles run counter-clockwise from the right, as on a clock face's 3. */
function slicePath(from: number, to: number): string {
  // Trimming by the same distance (not angle) at both radii keeps gaps even.
  const [outerFrom, outerTo] = [from - GAP / OUTER, to + GAP / OUTER];
  const [innerFrom, innerTo] = [from - GAP / INNER, to + GAP / INNER];
  const at = (angle: number, radius: number) => {
    const { x, y } = pointAt(angle, radius);
    return `${round(x)} ${round(y)}`;
  };
  return [
    `M ${at(outerFrom, OUTER)}`,
    `A ${OUTER} ${OUTER} 0 0 1 ${at(outerTo, OUTER)}`,
    `L ${at(innerTo, INNER)}`,
    `A ${INNER} ${INNER} 0 0 0 ${at(innerFrom, INNER)}`,
    'Z',
  ].join(' ');
}

function pointAt(angle: number, radius: number): Point {
  // Screen y grows downwards, so "up" is minus.
  return {
    x: OUTER + Math.cos(angle) * radius,
    y: OUTER - Math.sin(angle) * radius,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
