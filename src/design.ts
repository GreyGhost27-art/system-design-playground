import { distance, type Point } from './geometry.ts';
import {
  createRope,
  distanceToRope,
  reverseRope,
  stepRope,
  type Rope,
} from './rope.ts';

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 52;
/** A group is grabbed by its title strip, so dragging inside it still pans. */
export const GROUP_HANDLE_HEIGHT = 40;

export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];

export interface DesignNode {
  id: string;
  kind: string;
  /** Overrides the component's default name, e.g. "Primary DB". */
  label?: string;
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
  label?: string;
  /** Traffic only goes from → to, with no response coming back. */
  oneWay?: boolean;
  rope: Rope;
}

/** A labelled area drawn behind components, such as a region. */
export interface Group {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A full copy of the board's contents, used for undo. */
export interface DesignSnapshot {
  nodes: DesignNode[];
  cables: Cable[];
  groups: Group[];
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
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
  groups: Group[] = [];
  private lastId = 0;

  clear(): void {
    this.nodes = [];
    this.cables = [];
    this.groups = [];
  }

  snapshot(): DesignSnapshot {
    const { nodes, cables, groups } = this;
    return structuredClone({ nodes, cables, groups });
  }

  restore(snapshot: DesignSnapshot): void {
    const { nodes, cables, groups } = structuredClone(snapshot);
    Object.assign(this, { nodes, cables, groups });
  }

  addNode(kind: string, position: Point, label?: string): DesignNode {
    const node: DesignNode = { id: this.newId('node'), kind, ...position };
    if (label) node.label = label;
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

  connect(
    from: PortRef,
    to: PortRef,
    details: { label?: string; oneWay?: boolean; rope?: Rope } = {},
  ): Cable | null {
    if (!this.canConnect(from, to)) return null;
    const cable: Cable = {
      id: this.newId('cable'),
      from,
      to,
      rope:
        details.rope ?? createRope(this.portPoint(from), this.portPoint(to)),
    };
    if (details.label) cable.label = details.label;
    if (details.oneWay) cable.oneWay = true;
    this.cables.push(cable);
    return cable;
  }

  getCable(id: string): Cable {
    const cable = this.cables.find((candidate) => candidate.id === id);
    if (!cable) throw new Error(`Unknown cable: ${id}`);
    return cable;
  }

  /** Names a cable; an empty or blank label removes it. */
  setCableLabel(id: string, label: string): void {
    const cable = this.getCable(id);
    const trimmed = label.trim();
    if (trimmed) cable.label = trimmed;
    else delete cable.label;
  }

  setCableOneWay(id: string, oneWay: boolean): void {
    const cable = this.getCable(id);
    if (oneWay) cable.oneWay = true;
    else delete cable.oneWay;
  }

  /** Swaps a cable's ends, so its traffic runs the other way. */
  flipCable(id: string): void {
    const cable = this.getCable(id);
    [cable.from, cable.to] = [cable.to, cable.from];
    reverseRope(cable.rope);
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

  /** The area covered by components and groups, or null when empty. */
  bounds(): Bounds | null {
    const boxes: Bounds[] = [
      ...this.nodes.map((node) => ({
        left: node.x - NODE_WIDTH / 2,
        top: node.y - NODE_HEIGHT / 2,
        right: node.x + NODE_WIDTH / 2,
        bottom: node.y + NODE_HEIGHT / 2,
      })),
      ...this.groups.map((group) => ({
        left: group.x,
        top: group.y,
        right: group.x + group.width,
        bottom: group.y + group.height,
      })),
    ];
    if (boxes.length === 0) return null;
    return {
      left: Math.min(...boxes.map((box) => box.left)),
      top: Math.min(...boxes.map((box) => box.top)),
      right: Math.max(...boxes.map((box) => box.right)),
      bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
  }

  /** The group whose title strip is under `point`, as an index, or -1. */
  groupHandleAt(point: Point): number {
    return this.groups.findLastIndex(
      (group) =>
        point.x >= group.x &&
        point.x <= group.x + group.width &&
        point.y >= group.y &&
        point.y <= group.y + GROUP_HANDLE_HEIGHT,
    );
  }

  /** Components that overlap a group, even partly: they travel with it. */
  nodesTouching(groupIndex: number): DesignNode[] {
    const group = this.groups[groupIndex];
    return this.nodes.filter(
      (node) =>
        node.x + NODE_WIDTH / 2 >= group.x &&
        node.x - NODE_WIDTH / 2 <= group.x + group.width &&
        node.y + NODE_HEIGHT / 2 >= group.y &&
        node.y - NODE_HEIGHT / 2 <= group.y + group.height,
    );
  }

  /** Moves a group by `delta`, carrying the given components along. */
  moveGroup(groupIndex: number, delta: Point, nodeIds: string[]): void {
    const group = this.groups[groupIndex];
    group.x += delta.x;
    group.y += delta.y;
    for (const id of nodeIds) {
      const node = this.getNode(id);
      this.moveNode(id, { x: node.x + delta.x, y: node.y + delta.y });
    }
  }

  /** Cables plugged into a port, oldest first. */
  cablesAtPort(port: PortRef): Cable[] {
    const isPort = (end: PortRef) =>
      end.nodeId === port.nodeId && end.side === port.side;
    return this.cables.filter(({ from, to }) => isPort(from) || isPort(to));
  }

  /**
   * The cable whose end is near `point`, and which end, so a cable can be
   * grabbed close to its plug and pulled out.
   */
  cableEndAt(
    point: Point,
    reach = 40,
  ): { cable: Cable; end: 'from' | 'to' } | null {
    const cable = this.cableAt(point);
    if (!cable) return null;
    const { points } = cable.rope;
    const toStart = distance(point, points[0]);
    const toEnd = distance(point, points[points.length - 1]);
    if (Math.min(toStart, toEnd) > reach) return null;
    return { cable, end: toStart <= toEnd ? 'from' : 'to' };
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
