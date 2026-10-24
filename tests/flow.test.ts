import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  displaceCurve,
  displacementAt,
  pointAlong,
  polylineLength,
  smoothCurve,
  waveAt,
  type FlowSettings,
} from '../src/flow.ts';
import defaults from '../src/settings.json' with { type: 'json' };

// A 300-long cable: each wave takes (300 + 100) / 100 = 4 seconds to cross.
const settings: FlowSettings = {
  enabled: true,
  speed: 100,
  amplitude: 4,
  wavelength: 100,
  ripples: 1,
  pause: 1,
  rest: 2,
  showResponses: true,
};

test('a request wave runs from the start of the cable to its end', () => {
  assert.deepEqual(waveAt(300, 0, settings), { kind: 'request', center: -50 });
  assert.deepEqual(waveAt(300, 2, settings), { kind: 'request', center: 150 });
});

test('after a pause, a response wave runs back to the start', () => {
  assert.equal(waveAt(300, 4.5, settings), null);
  assert.deepEqual(waveAt(300, 5, settings), {
    kind: 'response',
    center: 350,
  });
  assert.deepEqual(waveAt(300, 7, settings), {
    kind: 'response',
    center: 150,
  });
});

test('the cable rests between exchanges, then the cycle repeats', () => {
  assert.equal(waveAt(300, 10, settings), null);
  assert.deepEqual(waveAt(300, 11, settings), waveAt(300, 0, settings));
});

test('without responses only request waves run', () => {
  const requestsOnly = { ...settings, showResponses: false };
  assert.equal(waveAt(300, 5, requestsOnly), null);
  assert.deepEqual(waveAt(300, 6, requestsOnly), waveAt(300, 0, settings));
});

test('nothing moves when the flow is disabled', () => {
  assert.equal(waveAt(300, 2, { ...settings, enabled: false }), null);
});

test('the cable only bends near the wave', () => {
  const wave = { kind: 'request' as const, center: 150 };
  assert.notEqual(displacementAt(130, 300, wave, settings), 0);
  assert.equal(displacementAt(40, 300, wave, settings), 0);
  assert.equal(displacementAt(260, 300, wave, settings), 0);
});

test('the ends of the cable never move, even as the wave passes', () => {
  const wave = { kind: 'request' as const, center: 10 };
  assert.equal(displacementAt(0, 300, wave, settings), 0);
  assert.equal(displacementAt(300, 300, { ...wave, center: 290 }, settings), 0);
});

test('the bend never exceeds the amplitude', () => {
  const wave = { kind: 'request' as const, center: 150 };
  for (let position = 0; position <= 300; position += 5) {
    const bend = displacementAt(position, 300, wave, settings);
    assert.ok(Math.abs(bend) <= settings.amplitude);
  }
});

test('the smooth curve keeps the rope ends and passes through midpoints', () => {
  const rope = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
  ];
  const curve = smoothCurve(rope, 4);
  assert.deepEqual(curve.at(0), { x: 0, y: 0 });
  assert.deepEqual(curve.at(-1), { x: 200, y: 0 });
  assert.ok(curve.some((point) => point.x === 150 && point.y === 0));
  assert.equal(polylineLength(curve), 200);
});

test('displacing a curve moves points sideways, not along it', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ];
  const moved = displaceCurve(line, (position) => (position === 10 ? 3 : 0));
  assert.deepEqual(moved, [
    { x: 0, y: 0 },
    { x: 10, y: 3 },
    { x: 20, y: 0 },
  ]);
});

test('the default flow settings are sensible', () => {
  const flow: FlowSettings = defaults.flow;
  assert.ok(flow.speed > 0 && flow.wavelength > 0 && flow.ripples > 0);
  assert.ok(flow.amplitude > 0 && flow.amplitude < flow.wavelength / 4);
  assert.ok(flow.pause >= 0 && flow.rest >= 0);
});

test('a point part of the way along a curve comes with its heading', () => {
  const curve = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];
  assert.deepEqual(pointAlong(curve, 0.25), {
    point: { x: 50, y: 0 },
    angle: 0,
  });
  assert.deepEqual(pointAlong(curve, 0.75), {
    point: { x: 100, y: 50 },
    angle: Math.PI / 2,
  });
});
