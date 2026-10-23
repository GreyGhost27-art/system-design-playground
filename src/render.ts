import type { Camera } from './camera.ts';
import { categoryColor, findKind } from './components.ts';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  SIDES,
  portPosition,
  type Cable,
  type Design,
  type DesignNode,
  type Group,
  type PortRef,
} from './design.ts';
import type { Point } from './geometry.ts';
import type { Rope } from './rope.ts';
import { PORT_RADIUS } from './snap.ts';

const BACKGROUND = '#0d1016';
const GRID_DOT = '#1f2531';
const GRID_SPACING = 24;
const NODE_FILL = '#161b24';
const TEXT = '#e6e9ef';
const MUTED = '#7d8596';
const CABLE_SHADOW = 'rgba(0, 0, 0, 0.55)';
const FONT_UI = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT_MONO = "ui-monospace, 'Cascadia Code', Consolas, monospace";

export type Selection = { type: 'node' | 'cable'; id: string };

export interface CableDraft {
  from: PortRef;
  rope: Rope;
  snap: PortRef | null;
}

export interface Scene {
  design: Design;
  camera: Camera;
  selection: Selection | null;
  hoveredNodeId: string | null;
  hoveredPort: PortRef | null;
  draft: CableDraft | null;
}

export function render(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  size: { width: number; height: number; pixelRatio: number },
): void {
  const { camera } = scene;
  const ratio = size.pixelRatio;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.setTransform(
    ratio * camera.scale,
    0,
    0,
    ratio * camera.scale,
    ratio * camera.x,
    ratio * camera.y,
  );
  drawGrid(ctx, camera, size);
  for (const group of scene.design.groups) drawGroup(ctx, group);
  for (const cable of scene.design.cables) {
    const selected = isSelected(scene, 'cable', cable.id);
    drawCable(ctx, scene.design, cable.from, cable.to, cable.rope, selected);
  }
  for (const cable of scene.design.cables) drawCableLabel(ctx, cable);
  for (const node of scene.design.nodes) {
    drawNode(ctx, node, {
      selected: isSelected(scene, 'node', node.id),
      hovered: scene.hoveredNodeId === node.id,
    });
  }
  drawPorts(ctx, scene);
  if (scene.draft) drawDraft(ctx, scene.design, scene.draft);

  if (scene.design.nodes.length === 0) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawEmptyState(ctx, size);
  }
}

function isSelected(scene: Scene, type: Selection['type'], id: string) {
  return scene.selection?.type === type && scene.selection.id === id;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  size: { width: number; height: number },
): void {
  const left = -camera.x / camera.scale;
  const top = -camera.y / camera.scale;
  const right = left + size.width / camera.scale;
  const bottom = top + size.height / camera.scale;
  const startX = Math.floor(left / GRID_SPACING) * GRID_SPACING;
  const startY = Math.floor(top / GRID_SPACING) * GRID_SPACING;
  const dotSize = 1.6 / camera.scale;

  ctx.fillStyle = GRID_DOT;
  for (let x = startX; x <= right; x += GRID_SPACING) {
    for (let y = startY; y <= bottom; y += GRID_SPACING) {
      ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
    }
  }
}

function nodeColor(node: DesignNode): string {
  return categoryColor(findKind(node.kind).category);
}

function drawCable(
  ctx: CanvasRenderingContext2D,
  design: Design,
  from: PortRef,
  to: PortRef,
  rope: Rope,
  selected: boolean,
): void {
  const fromColor = nodeColor(design.getNode(from.nodeId));
  const toColor = nodeColor(design.getNode(to.nodeId));
  drawRope(ctx, rope.points, fromColor, toColor, selected);
}

function drawDraft(
  ctx: CanvasRenderingContext2D,
  design: Design,
  draft: CableDraft,
): void {
  const fromColor = nodeColor(design.getNode(draft.from.nodeId));
  const toColor = draft.snap
    ? nodeColor(design.getNode(draft.snap.nodeId))
    : fromColor;
  drawRope(ctx, draft.rope.points, fromColor, toColor, false);
}

function drawRope(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  fromColor: string,
  toColor: string,
  selected: boolean,
): void {
  const start = points[0];
  const end = points[points.length - 1];
  const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  gradient.addColorStop(0, fromColor);
  gradient.addColorStop(1, toColor);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (selected) {
    traceRope(ctx, points);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 12;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, 3);
  traceRope(ctx, points);
  ctx.strokeStyle = CABLE_SHADOW;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  traceRope(ctx, points);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = selected ? 4 : 3;
  ctx.stroke();

  drawPlug(ctx, start, fromColor);
  drawPlug(ctx, end, toColor);
}

/** Smooth curve through the rope points, using midpoints as anchors. */
function traceRope(ctx: CanvasRenderingContext2D, points: Point[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawPlug(
  ctx: CanvasRenderingContext2D,
  point: Point,
  color: string,
): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, PORT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = BACKGROUND;
  ctx.stroke();
}

function drawGroup(ctx: CanvasRenderingContext2D, group: Group): void {
  ctx.beginPath();
  ctx.roundRect(group.x, group.y, group.width, group.height, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fill();
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#2c3442';
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = MUTED;
  ctx.font = `600 11px ${FONT_UI}`;
  ctx.fillText(group.label.toUpperCase(), group.x + 14, group.y + 12);
}

/** A small pill at the middle of the rope, so it moves with the cable. */
function drawCableLabel(ctx: CanvasRenderingContext2D, cable: Cable): void {
  if (!cable.label) return;
  const { points } = cable.rope;
  const middle = points[Math.floor(points.length / 2)];

  ctx.font = `500 11px ${FONT_UI}`;
  const width = ctx.measureText(cable.label).width + 14;
  const height = 20;
  ctx.beginPath();
  ctx.roundRect(middle.x - width / 2, middle.y - height / 2, width, height, 10);
  ctx.fillStyle = 'rgba(13, 16, 22, 0.92)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#2c3442';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#b7bdc9';
  ctx.fillText(cable.label, middle.x, middle.y + 0.5);
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: DesignNode,
  state: { selected: boolean; hovered: boolean },
): void {
  const kind = findKind(node.kind);
  const color = categoryColor(kind.category);
  const left = node.x - NODE_WIDTH / 2;
  const top = node.y - NODE_HEIGHT / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.roundRect(left, top, NODE_WIDTH, NODE_HEIGHT, 10);
  ctx.fillStyle = NODE_FILL;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(left, top, NODE_WIDTH, NODE_HEIGHT, 10);
  ctx.lineWidth = state.selected ? 2 : 1;
  ctx.strokeStyle = state.selected
    ? color
    : withAlpha(color, state.hovered ? 0.6 : 0.28);
  ctx.stroke();

  const badgeSize = 32;
  const badgeLeft = left + 10;
  const badgeTop = node.y - badgeSize / 2;
  ctx.beginPath();
  ctx.roundRect(badgeLeft, badgeTop, badgeSize, badgeSize, 7);
  ctx.fillStyle = withAlpha(color, 0.16);
  ctx.fill();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(kind.badge, badgeLeft + badgeSize / 2, node.y + 0.5);

  ctx.textAlign = 'left';
  const textLeft = badgeLeft + badgeSize + 10;
  const textWidth = left + NODE_WIDTH - 10 - textLeft;
  // A custom name ("Primary DB") keeps the component type as its caption.
  const caption = node.label ? kind.label : kind.category;
  ctx.fillStyle = TEXT;
  ctx.font = `600 13px ${FONT_UI}`;
  const title = fitText(ctx, node.label ?? kind.label, textWidth);
  ctx.fillText(title, textLeft, node.y - 7);
  ctx.fillStyle = MUTED;
  ctx.font = `500 11px ${FONT_UI}`;
  ctx.fillText(fitText(ctx, caption, textWidth), textLeft, node.y + 10);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened && ctx.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}…`;
}

/**
 * Ports appear on the hovered component, and on every component the
 * cable being drawn could plug into.
 */
function drawPorts(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { design, draft } = scene;
  for (const node of design.nodes) {
    const acceptsDraft =
      draft !== null &&
      node.id !== draft.from.nodeId &&
      !design.areConnected(draft.from.nodeId, node.id);
    if (!acceptsDraft && scene.hoveredNodeId !== node.id) continue;

    const color = nodeColor(node);
    for (const side of SIDES) {
      const port = { nodeId: node.id, side };
      const position = portPosition(node, side);
      const snapped = samePort(draft?.snap, port);
      const hovered = samePort(scene.hoveredPort, port);
      drawPort(ctx, position, color, { active: snapped || hovered });
      if (snapped) drawSnapRing(ctx, position, color);
    }
  }
}

function drawPort(
  ctx: CanvasRenderingContext2D,
  point: Point,
  color: string,
  state: { active: boolean },
): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, PORT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = state.active ? color : BACKGROUND;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawSnapRing(
  ctx: CanvasRenderingContext2D,
  point: Point,
  color: string,
): void {
  const pulse = (Math.sin(performance.now() / 120) + 1) / 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, PORT_RADIUS + 5 + pulse * 3, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = withAlpha(color, 0.5);
  ctx.stroke();
}

function drawEmptyState(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = MUTED;
  ctx.font = `500 14px ${FONT_UI}`;
  ctx.fillText(
    'Drag components here to start building',
    size.width / 2,
    size.height / 2,
  );
}

function samePort(a: PortRef | null | undefined, b: PortRef): boolean {
  return a?.nodeId === b.nodeId && a.side === b.side;
}

function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
