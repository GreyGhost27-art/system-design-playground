import { distance, lerp, type Point } from '../model/geometry.ts';

export interface FlowSettings {
  enabled: boolean;
  /** How fast a wave runs along a cable, in board units per second. */
  speed: number;
  /** Largest sideways displacement of the cable. */
  amplitude: number;
  /** Length of cable a single wave covers. */
  wavelength: number;
  /** Number of wiggles inside one wave. */
  ripples: number;
  /** Seconds between a request arriving and its response leaving. */
  pause: number;
  /** Seconds of stillness before the next exchange. */
  rest: number;
  showResponses: boolean;
}

export interface Wave {
  /** Distance of the wave's centre from the cable's `from` end. */
  center: number;
  kind: 'request' | 'response';
}

/**
 * The wave on a cable at a moment in time. Each exchange is a request wave
 * running from → to, a short pause, a response wave running back, and a
 * rest. `phase` (seconds) keeps neighbouring cables out of step.
 */
export function waveAt(
  length: number,
  seconds: number,
  settings: FlowSettings,
  phase = 0,
): Wave | null {
  if (!settings.enabled || length <= 0) return null;
  // A wave starts just before the cable and ends just past it.
  const runway = length + settings.wavelength;
  const travel = runway / settings.speed;
  const response = settings.showResponses ? settings.pause + travel : 0;
  const cycle = travel + response + settings.rest;
  const time = modulo(seconds + phase, cycle);
  const halfWave = settings.wavelength / 2;

  if (time < travel) {
    return { kind: 'request', center: time * settings.speed - halfWave };
  }
  const returning = time - travel - settings.pause;
  if (settings.showResponses && returning >= 0 && returning < travel) {
    return {
      kind: 'response',
      center: length + halfWave - returning * settings.speed,
    };
  }
  return null;
}

/** Sideways displacement of the cable at `position` along it. */
export function displacementAt(
  position: number,
  length: number,
  wave: Wave,
  settings: FlowSettings,
): number {
  const halfWave = settings.wavelength / 2;
  const fromCenter = position - wave.center;
  const offCable = position <= 0 || position >= length;
  if (offCable || Math.abs(fromCenter) >= halfWave) return 0;
  // A smooth bump that holds the wiggles, so the wave has soft edges.
  const envelope = (1 + Math.cos((Math.PI * fromCenter) / halfWave)) / 2;
  const wiggle = Math.sin(
    (2 * Math.PI * settings.ripples * fromCenter) / settings.wavelength,
  );
  // The plugs never move: the wave dies out at both ends of the cable.
  const anchored = Math.min(
    1,
    position / halfWave,
    (length - position) / halfWave,
  );
  return settings.amplitude * envelope * wiggle * anchored;
}

/** Dense points along the smooth curve drawn through a rope's points. */
export function smoothCurve(points: Point[], samplesPerSegment = 6): Point[] {
  const curve = [points[0]];
  let start = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i];
    const end = lerp(points[i], points[i + 1], 0.5);
    for (let step = 1; step <= samplesPerSegment; step++) {
      curve.push(quadratic(start, control, end, step / samplesPerSegment));
    }
    start = end;
  }
  curve.push(points[points.length - 1]);
  return curve;
}

/** Moves each point sideways (along the curve's normal) by `offsetAt`. */
export function displaceCurve(
  curve: Point[],
  offsetAt: (position: number) => number,
): Point[] {
  let position = 0;
  return curve.map((point, i) => {
    if (i > 0) position += distance(curve[i - 1], point);
    const offset = offsetAt(position);
    if (offset === 0) return point;
    const before = curve[Math.max(0, i - 1)];
    const after = curve[Math.min(curve.length - 1, i + 1)];
    const tangentLength = distance(before, after) || 1;
    const normalX = -(after.y - before.y) / tangentLength;
    const normalY = (after.x - before.x) / tangentLength;
    return { x: point.x + normalX * offset, y: point.y + normalY * offset };
  });
}

/** The point at `fraction` of the way along a curve, and its heading. */
export function pointAlong(
  curve: Point[],
  fraction: number,
): { point: Point; angle: number } {
  let remaining = polylineLength(curve) * fraction;
  for (let i = 1; i < curve.length; i++) {
    const [start, end] = [curve[i - 1], curve[i]];
    const step = distance(start, end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    if (remaining <= step || i === curve.length - 1) {
      const t = step === 0 ? 0 : Math.min(1, remaining / step);
      return { point: lerp(start, end, t), angle };
    }
    remaining -= step;
  }
  return { point: curve[0], angle: 0 };
}

export function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

function quadratic(start: Point, control: Point, end: Point, t: number) {
  return lerp(lerp(start, control, t), lerp(control, end, t), t);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
