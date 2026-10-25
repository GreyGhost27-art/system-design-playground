import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Design,
  nextCopyLabel,
  portPosition,
  type PortRef,
} from '../src/model/design.ts';
import { rectBetween } from '../src/model/geometry.ts';

function twoComponents() {
  const design = new Design();
  const client = design.addNode('client', { x: 0, y: 0 });
  const server = design.addNode('app-server', { x: 400, y: 0 });
  return { design, client, server };
}

const port = (nodeId: string, side: PortRef['side'] = 'right'): PortRef => ({
  nodeId,
  side,
});

test('adding a component places it at the given position', () => {
  const design = new Design();
  const node = design.addNode('cache', { x: 40, y: 80 });
  assert.equal(node.kind, 'cache');
  assert.deepEqual({ x: node.x, y: node.y }, { x: 40, y: 80 });
});

test('ports sit in the middle of each side of a component', () => {
  const node = { id: 'n', kind: 'cache', x: 0, y: 0 };
  assert.deepEqual(portPosition(node, 'top'), { x: 0, y: -26 });
  assert.deepEqual(portPosition(node, 'right'), { x: 88, y: 0 });
  assert.deepEqual(portPosition(node, 'bottom'), { x: 0, y: 26 });
  assert.deepEqual(portPosition(node, 'left'), { x: -88, y: 0 });
});

test('a cable connects ports on two different components', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id, 'left'));
  assert.ok(cable);
  assert.equal(design.cables.length, 1);
});

test('a component cannot be connected to itself', () => {
  const { design, client } = twoComponents();
  assert.equal(design.connect(port(client.id), port(client.id, 'top')), null);
});

test('two components can only be connected once, in either direction', () => {
  const { design, client, server } = twoComponents();
  design.connect(port(client.id), port(server.id));
  assert.equal(design.connect(port(client.id, 'top'), port(server.id)), null);
  assert.equal(design.connect(port(server.id), port(client.id)), null);
});

test('removing a component removes its cables', () => {
  const { design, client, server } = twoComponents();
  design.connect(port(client.id), port(server.id));
  design.removeNode(server.id);
  assert.equal(design.nodes.length, 1);
  assert.equal(design.cables.length, 0);
});

test('the topmost component under a point is found', () => {
  const design = new Design();
  design.addNode('client', { x: 0, y: 0 });
  const top = design.addNode('cache', { x: 20, y: 0 });
  assert.equal(design.nodeAt({ x: 10, y: 0 })?.id, top.id);
  assert.equal(design.nodeAt({ x: 1000, y: 0 }), null);
});

test('a component brought to front is found before the ones below it', () => {
  const design = new Design();
  const bottom = design.addNode('client', { x: 0, y: 0 });
  design.addNode('cache', { x: 20, y: 0 });
  design.bringToFront(bottom.id);
  assert.equal(design.nodeAt({ x: 10, y: 0 })?.id, bottom.id);
});

test('a cable is found when the point is near its rope', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id, 'left'));
  assert.equal(design.cableAt({ x: 200, y: 4 })?.id, cable?.id);
  assert.equal(design.cableAt({ x: 200, y: 100 }), null);
});

test('cables follow a component when it moves', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id, 'left'))!;
  design.moveNode(server.id, { x: 400, y: 300 });
  design.step();
  assert.deepEqual(cable.rope.points.at(-1), { x: 312, y: 300 });
});

test('clearing the board removes components, cables and groups', () => {
  const { design, client, server } = twoComponents();
  design.connect(port(client.id), port(server.id));
  design.groups.push({ label: 'EU', x: 0, y: 0, width: 10, height: 10 });
  design.clear();
  assert.deepEqual([design.nodes, design.cables, design.groups], [[], [], []]);
});

test('a component can be given its own name', () => {
  const design = new Design();
  const node = design.addNode('sql-database', { x: 0, y: 0 }, 'Primary DB');
  assert.equal(node.label, 'Primary DB');
});

test('a cable can carry a label', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id), {
    label: 'HTTP',
  });
  assert.equal(cable?.label, 'HTTP');
});

test('a cable can be made one-way and back to two-way', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id))!;
  design.setCableOneWay(cable.id, true);
  assert.equal(cable.oneWay, true);
  design.setCableOneWay(cable.id, false);
  assert.equal('oneWay' in cable, false);
});

test('flipping a cable swaps its ends and reverses its rope', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id, 'left'))!;
  const firstPoint = cable.rope.points[0];
  design.flipCable(cable.id);
  assert.deepEqual(cable.from, port(server.id, 'left'));
  assert.deepEqual(cable.to, port(client.id));
  assert.equal(cable.rope.points.at(-1), firstPoint);
});

test('the bounds cover every component and group', () => {
  const { design } = twoComponents();
  design.groups.push({ label: 'EU', x: -200, y: 0, width: 50, height: 400 });
  assert.deepEqual(design.bounds(), {
    left: -200,
    top: -26,
    right: 488,
    bottom: 400,
  });
});

test('an empty board has no bounds', () => {
  assert.equal(new Design().bounds(), null);
});

test('a snapshot is unaffected by later changes to the board', () => {
  const { design, client } = twoComponents();
  const snapshot = design.snapshot();
  design.moveNode(client.id, { x: 999, y: 999 });
  design.removeNode(client.id);
  assert.equal(snapshot.nodes.length, 2);
  assert.deepEqual([snapshot.nodes[0].x, snapshot.nodes[0].y], [0, 0]);
});

test('restoring a snapshot brings back its components and cables', () => {
  const { design, client, server } = twoComponents();
  design.connect(port(client.id), port(server.id));
  const snapshot = design.snapshot();
  design.clear();
  design.restore(snapshot);
  assert.equal(design.nodes.length, 2);
  assert.equal(design.cables.length, 1);
});

test('a cable can be labelled after it is connected', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id))!;
  design.setCableLabel(cable.id, '  reads  ');
  assert.equal(cable.label, 'reads');
});

test('clearing a cable label removes it', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id), {
    label: 'HTTP',
  })!;
  design.setCableLabel(cable.id, '   ');
  assert.equal('label' in cable, false);
});

test('a cable is grabbed by the end nearest the pointer', () => {
  const { design, client, server } = twoComponents();
  const cable = design.connect(port(client.id), port(server.id, 'left'))!;
  assert.deepEqual(design.cableEndAt({ x: 110, y: 0 }), {
    cable,
    end: 'from',
  });
  assert.deepEqual(design.cableEndAt({ x: 290, y: 0 }), { cable, end: 'to' });
});

test('the middle of a cable is not one of its ends', () => {
  const { design, client, server } = twoComponents();
  design.connect(port(client.id), port(server.id, 'left'));
  assert.equal(design.cableEndAt({ x: 200, y: 0 }), null);
  assert.equal(design.cableEndAt({ x: 110, y: 200 }), null);
});

test('the cables plugged into a port are listed oldest first', () => {
  const design = new Design();
  const lb = design.addNode('load-balancer', { x: 0, y: 0 });
  const app1 = design.addNode('app-server', { x: 300, y: -100 });
  const app2 = design.addNode('app-server', { x: 300, y: 100 });
  const first = design.connect(port(lb.id), port(app1.id, 'left'))!;
  const second = design.connect(port(lb.id), port(app2.id, 'left'))!;
  assert.deepEqual(design.cablesAtPort(port(lb.id)), [first, second]);
  assert.deepEqual(design.cablesAtPort(port(app2.id, 'left')), [second]);
  assert.deepEqual(design.cablesAtPort(port(lb.id, 'top')), []);
});

function designWithRegion() {
  const design = new Design();
  design.groups = [{ label: 'EU', x: 0, y: 0, width: 400, height: 300 }];
  const inside = design.addNode('app-server', { x: 200, y: 150 });
  const onEdge = design.addNode('cache', { x: 420, y: 150 });
  const outside = design.addNode('client', { x: 800, y: 150 });
  return { design, inside, onEdge, outside };
}

test('a group is grabbed by its title strip, not by its middle', () => {
  const { design } = designWithRegion();
  assert.equal(design.groupHandleAt({ x: 100, y: 20 }), 0);
  assert.equal(design.groupHandleAt({ x: 100, y: 150 }), -1);
  assert.equal(design.groupHandleAt({ x: 500, y: 20 }), -1);
});

test('components inside a group or overlapping its edge belong to it', () => {
  const { design, inside, onEdge } = designWithRegion();
  const ids = design.nodesTouching(0).map((node) => node.id);
  assert.deepEqual(ids, [inside.id, onEdge.id]);
});

test('moving a group carries its components and leaves others behind', () => {
  const { design, inside, outside } = designWithRegion();
  design.moveGroup(0, { x: 50, y: -20 }, [inside.id]);
  assert.deepEqual(design.groups[0], {
    label: 'EU',
    x: 50,
    y: -20,
    width: 400,
    height: 300,
  });
  assert.deepEqual([inside.x, inside.y], [250, 130]);
  assert.deepEqual([outside.x, outside.y], [800, 150]);
});

test('a new group can be added and renamed', () => {
  const design = new Design();
  const area = { x: 10, y: 20, width: 300, height: 200 };
  const index = design.addGroup({ label: 'Group', ...area });
  design.renameGroup(index, 'EU region');
  assert.deepEqual(design.groups, [{ label: 'EU region', ...area }]);
});

test('a dragged area is the same whichever corner it starts from', () => {
  const expected = { x: 10, y: 20, width: 90, height: 60 };
  assert.deepEqual(rectBetween({ x: 10, y: 20 }, { x: 100, y: 80 }), expected);
  assert.deepEqual(rectBetween({ x: 100, y: 80 }, { x: 10, y: 20 }), expected);
});

test('removing a group leaves its components on the board', () => {
  const { design, inside } = designWithRegion();
  design.removeGroup(0);
  assert.deepEqual(design.groups, []);
  assert.ok(design.nodes.includes(inside));
});

test('grabbing near a corner of a group gives the opposite corner', () => {
  const { design } = designWithRegion();
  assert.deepEqual(design.groupCornerAt(0, { x: 398, y: 302 }, 10), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(design.groupCornerAt(0, { x: 4, y: 296 }, 10), {
    x: 400,
    y: 0,
  });
  assert.equal(design.groupCornerAt(0, { x: 200, y: 150 }, 10), null);
});

test('a group resizes from its fixed corner, never below its minimum', () => {
  const { design } = designWithRegion();
  design.resizeGroup(0, { x: 0, y: 0 }, { x: 500, y: 350 });
  assert.deepEqual(design.groups[0], {
    label: 'EU',
    x: 0,
    y: 0,
    width: 500,
    height: 350,
  });
  design.resizeGroup(0, { x: 0, y: 0 }, { x: 20, y: 10 });
  assert.equal(design.groups[0].width, 160);
  assert.equal(design.groups[0].height, 80);
});

test('dragging a corner past the fixed one flips the group over', () => {
  const { design } = designWithRegion();
  design.resizeGroup(0, { x: 400, y: 300 }, { x: 100, y: -50 });
  const { x, y, width, height } = design.groups[0];
  assert.deepEqual(
    { x, y, width, height },
    {
      x: 100,
      y: -50,
      width: 300,
      height: 350,
    },
  );
});

test('a copy is a new box below the original, wired the same way', () => {
  const { design, client, server } = twoComponents();
  design.connect(port(client.id), port(server.id, 'left'), {
    label: 'HTTP',
    oneWay: true,
  });
  const copy = design.copyWithConnections(server.id);
  assert.equal(copy.kind, 'app-server');
  assert.deepEqual([copy.x, copy.y], [400, 88]);
  const cable = design.cablesOf(copy.id)[0];
  assert.deepEqual(cable.from, port(client.id));
  assert.deepEqual(cable.to, port(copy.id, 'left'));
  assert.equal(cable.label, 'HTTP');
  assert.equal(cable.oneWay, true);
});

test('a copy skips spots that are already taken', () => {
  const { design, server } = twoComponents();
  design.addNode('cache', { x: 400, y: 88 });
  const copy = design.copyWithConnections(server.id);
  assert.deepEqual([copy.x, copy.y], [400, 176]);
});

test('copies are numbered after the original', () => {
  assert.equal(nextCopyLabel('App Server', []), 'App Server 2');
  assert.equal(nextCopyLabel('App Server 2', ['App Server 3']), 'App Server 4');
  assert.equal(nextCopyLabel('Database', ['Database 2']), 'Database 3');
});
