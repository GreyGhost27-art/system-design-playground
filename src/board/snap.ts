import {
  SIDES,
  containsPoint,
  portPosition,
  type DesignNode,
  type PortRef,
} from '../model/design.ts';
import { distance, type Point } from '../model/geometry.ts';

export const PORT_RADIUS = 6;
const PORT_GRAB_RADIUS = 12;
export const SNAP_RADIUS = 44;

type PortFilter = (port: PortRef) => boolean;

export function portAt(nodes: DesignNode[], point: Point): PortRef | null {
  return nearestPort(nodes, point, PORT_GRAB_RADIUS, () => true);
}

/**
 * Where a dragged cable end should attach: any port within reach, or the
 * closest port of the component under the pointer, so dropping a cable
 * anywhere on a component is enough.
 */
export function findSnapTarget(
  nodes: DesignNode[],
  point: Point,
  accepts: PortFilter,
): PortRef | null {
  const nearby = nearestPort(nodes, point, SNAP_RADIUS, accepts);
  if (nearby) return nearby;
  const hovered = nodes.findLast((node) => containsPoint(node, point));
  if (!hovered) return null;
  return nearestPort([hovered], point, Infinity, accepts);
}

function nearestPort(
  nodes: DesignNode[],
  point: Point,
  maxDistance: number,
  accepts: PortFilter,
): PortRef | null {
  let best: PortRef | null = null;
  let bestDistance = maxDistance;
  for (const node of nodes) {
    for (const side of SIDES) {
      const port = { nodeId: node.id, side };
      const portDistance = distance(point, portPosition(node, side));
      if (portDistance <= bestDistance && accepts(port)) {
        best = port;
        bestDistance = portDistance;
      }
    }
  }
  return best;
}
