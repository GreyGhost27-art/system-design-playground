import type { Point } from './geometry.ts';
import { createRope, distanceToRope, stepRope, type Rope } from './rope.ts';

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 52;

export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];

export interface DesignNode {
  id: string;
  kind: string;
  x: number;
  y: number;
}

export interface PortRef {
  nodeId: string;
  side: Side;
}

export interface Cable {
  id: string;
  from: PortRef;
  to: PortRef;
  rope: Rope;
}

export function portPosition(node: DesignNode, side: Side): Point {
  const halfWidth = NODE_WIDTH / 2;
  const halfHeight = NODE_HEIGHT / 2;
  switch (side) {
    case 'top':
      return { x: node.x, y: node.y - halfHeight };
    case 'right':
      return { x: node.x + halfWidth, y: node.y };
    case 'bottom':
      return { x: node.x, y: node.y + halfHeight };
    case 'left':
      return { x: node.x - halfWidth, y: node.y };
  }
}

export function containsPoint(node: DesignNode, point: Point): boolean {
  return (
    Math.abs(point.x - node.x) <= NODE_WIDTH / 2 &&
    Math.abs(point.y - node.y) <= NODE_HEIGHT / 2
  );
}

export class Design {
  nodes: DesignNode[] = [];
  cables: Cable[] = [];
  private lastId = 0;

  addNode(kind: string, position: Point): DesignNode {
    const node = { id: this.newId('node'), kind, ...position };
    this.nodes.push(node);
    return node;
  }

  getNode(id: string): DesignNode {
    const node = this.nodes.find((candidate) => candidate.id === id);
    if (!node) throw new Error(`Unknown node: ${id}`);
    return node;
  }

  moveNode(id: string, position: Point): void {
    Object.assign(this.getNode(id), position);
  }

  bringToFront(id: string): void {
    const node = this.getNode(id);
    this.nodes = [...this.nodes.filter((other) => other !== node), node];
  }

  removeNode(id: string): void {
    this.nodes = this.nodes.filter((node) => node.id !== id);
    this.cables = this.cables.filter(
      (cable) => cable.from.nodeId !== id && cable.to.nodeId !== id,
    );
  }

  areConnected(nodeA: string, nodeB: string): boolean {
    return this.cables.some(
      ({ from, to }) =>
        (from.nodeId === nodeA && to.nodeId === nodeB) ||
        (from.nodeId === nodeB && to.nodeId === nodeA),
    );
  }

  canConnect(from: PortRef, to: PortRef): boolean {
    return (
      from.nodeId !== to.nodeId && !this.areConnected(from.nodeId, to.nodeId)
    );
  }

  connect(from: PortRef, to: PortRef, rope?: Rope): Cable | null {
    if (!this.canConnect(from, to)) return null;
    const cable = {
      id: this.newId('cable'),
      from,
      to,
      rope: rope ?? createRope(this.portPoint(from), this.portPoint(to)),
    };
    this.cables.push(cable);
    return cable;
  }

  removeCable(id: string): void {
    this.cables = this.cables.filter((cable) => cable.id !== id);
  }

  portPoint(port: PortRef): Point {
    return portPosition(this.getNode(port.nodeId), port.side);
  }

  nodeAt(point: Point): DesignNode | null {
    return this.nodes.findLast((node) => containsPoint(node, point)) ?? null;
  }

  cableAt(point: Point, tolerance = 8): Cable | null {
    const isNear = (cable: Cable) =>
      distanceToRope(cable.rope, point) <= tolerance;
    return this.cables.findLast(isNear) ?? null;
  }

  step(): void {
    for (const cable of this.cables) {
      stepRope(
        cable.rope,
        this.portPoint(cable.from),
        this.portPoint(cable.to),
      );
    }
  }

  private newId(prefix: string): string {
    this.lastId += 1;
    return `${prefix}-${this.lastId}`;
  }
}
