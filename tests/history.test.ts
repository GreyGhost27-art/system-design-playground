import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Design } from '../src/design.ts';
import { UndoHistory } from '../src/history.ts';

const kinds = (design: Design) => design.nodes.map((node) => node.kind);

test('undo puts back the design as it was before the last change', () => {
  const design = new Design();
  const history = new UndoHistory();
  history.record(design);
  design.addNode('cache', { x: 0, y: 0 });
  assert.equal(history.undo(design), true);
  assert.deepEqual(design.nodes, []);
});

test('changes are undone one at a time, newest first', () => {
  const design = new Design();
  const history = new UndoHistory();
  history.record(design);
  design.addNode('client', { x: 0, y: 0 });
  history.record(design);
  design.addNode('cache', { x: 300, y: 0 });

  history.undo(design);
  assert.deepEqual(kinds(design), ['client']);
  history.undo(design);
  assert.deepEqual(kinds(design), []);
});

test('undo brings back a deleted component together with its cables', () => {
  const design = new Design();
  const history = new UndoHistory();
  const client = design.addNode('client', { x: 0, y: 0 });
  const server = design.addNode('app-server', { x: 300, y: 0 });
  design.connect(
    { nodeId: client.id, side: 'right' },
    { nodeId: server.id, side: 'left' },
    { label: 'HTTP' },
  );

  history.record(design);
  design.removeNode(server.id);
  history.undo(design);

  assert.deepEqual(kinds(design), ['client', 'app-server']);
  assert.equal(design.cables[0].label, 'HTTP');
});

test('undo restores a moved component to where it was', () => {
  const design = new Design();
  const history = new UndoHistory();
  const node = design.addNode('cache', { x: 0, y: 0 });
  history.record(design);
  design.moveNode(node.id, { x: 500, y: 200 });
  history.undo(design);
  assert.deepEqual(
    { x: design.nodes[0].x, y: design.nodes[0].y },
    {
      x: 0,
      y: 0,
    },
  );
});

test('there is nothing to undo on a fresh or cleared history', () => {
  const design = new Design();
  const history = new UndoHistory();
  assert.equal(history.undo(design), false);
  history.record(design);
  history.clear();
  assert.equal(history.undo(design), false);
});

test('only the last hundred changes are kept', () => {
  const design = new Design();
  const history = new UndoHistory();
  for (let i = 0; i < 150; i++) {
    history.record(design);
    design.addNode('cache', { x: i, y: 0 });
  }
  let steps = 0;
  while (history.undo(design)) steps++;
  assert.equal(steps, 100);
  assert.equal(design.nodes.length, 50);
});
