import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DesignNode } from './design.ts';
import { findSnapTarget, portAt } from './snap.ts';

const server: DesignNode = { id: 'server', kind: 'app-server', x: 0, y: 0 };
const database: DesignNode = { id: 'db', kind: 'sql-database', x: 400, y: 0 };
const nodes = [server, database];
const anyPort = () => true;

test('a port is grabbed when the pointer is on it', () => {
  assert.deepEqual(portAt(nodes, { x: 86, y: 2 }), {
    nodeId: 'server',
    side: 'right',
  });
});

test('no port is grabbed from the middle of a component', () => {
  assert.equal(portAt(nodes, { x: 0, y: 0 }), null);
});

test('a dragged cable snaps to the nearest port within reach', () => {
  assert.deepEqual(findSnapTarget(nodes, { x: 290, y: 20 }, anyPort), {
    nodeId: 'db',
    side: 'left',
  });
});

test('a dragged cable does not snap when no port is within reach', () => {
  assert.equal(findSnapTarget(nodes, { x: 200, y: 200 }, anyPort), null);
});

test('a cable dropped on a component snaps to its closest port', () => {
  assert.deepEqual(findSnapTarget(nodes, { x: 460, y: 5 }, anyPort), {
    nodeId: 'db',
    side: 'right',
  });
});

test('ports that cannot accept the cable are skipped', () => {
  const notServer = (port: { nodeId: string }) => port.nodeId !== 'server';
  assert.equal(findSnapTarget(nodes, { x: 86, y: 0 }, notServer), null);
});
