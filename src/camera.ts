import { clamp, type Point } from './geometry.ts';

/** `x` and `y` are where the world origin appears on screen. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;

export function screenToWorld(camera: Camera, point: Point): Point {
  return {
    x: (point.x - camera.x) / camera.scale,
    y: (point.y - camera.y) / camera.scale,
  };
}

export function zoomAt(
  camera: Camera,
  screenPoint: Point,
  factor: number,
): Camera {
  const scale = clamp(camera.scale * factor, MIN_SCALE, MAX_SCALE);
  const anchor = screenToWorld(camera, screenPoint);
  return {
    scale,
    x: screenPoint.x - anchor.x * scale,
    y: screenPoint.y - anchor.y * scale,
  };
}
