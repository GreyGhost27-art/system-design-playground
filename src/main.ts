import { fitCamera, screenToWorld, zoomAt } from './camera.ts';
import { renderComponentInfo } from './componentInfo.ts';
import { findKind } from './components.ts';
import { Design, type PortRef } from './design.ts';
import type { Point } from './geometry.ts';
import { UndoHistory } from './history.ts';
import { renderLesson } from './lesson.ts';
import { DRAG_FORMAT, renderPalette } from './palette.ts';
import { render, type Scene } from './render.ts';
import { createRope, stepRope } from './rope.ts';
import settings from './settings.json' with { type: 'json' };
import { findSnapTarget, portAt } from './snap.ts';
import { TEMPLATES } from './templateLibrary.ts';
import { loadTemplate, toTemplate, type Template } from './templates.ts';

type Gesture =
  | { type: 'idle' }
  | { type: 'moving-node'; nodeId: string; grabOffset: Point; moved: boolean }
  | { type: 'drawing-cable' }
  | { type: 'panning'; last: Point };

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const ctx = canvas.getContext('2d')!;
const palette = document.querySelector<HTMLElement>('#palette')!;
const templateSelect =
  document.querySelector<HTMLSelectElement>('#template-select')!;
const drawer = document.querySelector<HTMLElement>('#drawer')!;
const drawerContent = document.querySelector<HTMLElement>('#drawer-content')!;
const drawerCloseButton = document.querySelector<HTMLElement>('#drawer-close')!;
const lessonOpenButton = document.querySelector<HTMLElement>('#lesson-open')!;
const copyJsonButton = document.querySelector<HTMLElement>('#copy-json')!;
const flowToggle = document.querySelector<HTMLInputElement>('#flow-toggle')!;

// Space the drawer covers on the right of the board when open.
const DRAWER_SPACE = 372;
// Physics steps run before showing a template, so cables appear settled.
const SETTLE_STEPS = 90;
// Each paste lands this far down and right of the last copy.
const PASTE_OFFSET = 40;

const design = new Design();
const undoHistory = new UndoHistory();
const scene: Scene = {
  design,
  camera: { x: 0, y: 0, scale: 1 },
  selection: null,
  hoveredNodeId: null,
  hoveredPort: null,
  draft: null,
  flow: { ...settings.flow },
  time: 0,
};
let gesture: Gesture = { type: 'idle' };
let pointer: Point = { x: 0, y: 0 };
let currentTemplate: Template | null = null;
let lessonOpen = true;
// What the drawer currently shows, so it is only rebuilt when that changes.
let drawerShowing = '';
let copied: { kind: string; label?: string; x: number; y: number } | null =
  null;

renderPalette(palette, (kindId) => addAtViewCenter(kindId));
fillTemplateSelect();

function fillTemplateSelect(): void {
  templateSelect.append(new Option('Empty board (free mode)', ''));
  const group = document.createElement('optgroup');
  group.label = 'Templates';
  TEMPLATES.forEach((template, index) => {
    group.append(new Option(`${index + 1}. ${template.title}`, template.id));
  });
  templateSelect.append(group);
}

function openTemplate(id: string): void {
  currentTemplate = TEMPLATES.find((template) => template.id === id) ?? null;
  templateSelect.value = currentTemplate?.id ?? '';
  scene.selection = null;
  undoHistory.clear();
  if (currentTemplate) loadTemplate(design, currentTemplate);
  else design.clear();
  for (let i = 0; i < SETTLE_STEPS; i++) design.step();
  syncDrawer();
  history.replaceState(null, '', currentTemplate ? `#${id}` : '#');
  fitToDesign();
}

/**
 * The drawer explains the selected component; with nothing selected it
 * shows the template's lesson, unless the lesson was closed.
 */
function syncDrawer(): void {
  const selection = scene.selection;
  const node = selection?.type === 'node' ? design.getNode(selection.id) : null;
  const showLesson = !node && currentTemplate !== null && lessonOpen;
  const showing = node
    ? `node:${node.id}:${node.label ?? ''}`
    : showLesson
      ? `lesson:${currentTemplate!.id}`
      : '';

  lessonOpenButton.hidden = !currentTemplate || lessonOpen || node !== null;
  if (showing === drawerShowing) return;
  drawerShowing = showing;
  drawer.hidden = showing === '';

  if (node) {
    renderComponentInfo(drawerContent, findKind(node.kind), node.label);
  } else if (showLesson) {
    renderLesson(drawerContent, currentTemplate!, {
      number: TEMPLATES.indexOf(currentTemplate!) + 1,
      total: TEMPLATES.length,
    });
  }
  drawerContent.scrollTop = 0;
  drawer.scrollTop = 0;
}

function fitToDesign(): void {
  const bounds = design.bounds();
  if (!bounds) {
    scene.camera = { x: 0, y: 0, scale: 1 };
    return;
  }
  const { width, height } = boardSize();
  const covered = drawer.hidden ? 0 : DRAWER_SPACE;
  scene.camera = fitCamera(bounds, { width: width - covered, height }, 48);
}

templateSelect.addEventListener('change', () => {
  openTemplate(templateSelect.value);
  templateSelect.blur();
});

drawerCloseButton.addEventListener('click', () => {
  // Closing a component's explanation falls back to the lesson.
  if (scene.selection?.type === 'node') scene.selection = null;
  else setLessonOpen(false);
  syncDrawer();
});
lessonOpenButton.addEventListener('click', () => setLessonOpen(true));

function setLessonOpen(open: boolean): void {
  lessonOpen = open;
  syncDrawer();
  fitToDesign();
}

copyJsonButton.addEventListener('click', async () => {
  const json = JSON.stringify(toTemplate(design), null, 2);
  await navigator.clipboard.writeText(json);
  copyJsonButton.textContent = 'Copied!';
  setTimeout(() => (copyJsonButton.textContent = 'Copy board as JSON'), 1500);
});

function boardSize() {
  return {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    pixelRatio: window.devicePixelRatio || 1,
  };
}

function resize(): void {
  const { width, height, pixelRatio } = boardSize();
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
}
new ResizeObserver(resize).observe(canvas);

function toWorld(event: MouseEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  const screenPoint = {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
  return screenToWorld(scene.camera, screenPoint);
}

function addAtViewCenter(kindId: string): void {
  const { width, height } = boardSize();
  const center = screenToWorld(scene.camera, { x: width / 2, y: height / 2 });
  // Nudge each click-added component so they don't stack exactly.
  const jitter = () => (Math.random() - 0.5) * 80;
  undoHistory.record(design);
  const node = design.addNode(kindId, {
    x: center.x + jitter(),
    y: center.y + jitter(),
  });
  scene.selection = { type: 'node', id: node.id };
}

function canPlugInto(from: PortRef) {
  return (port: PortRef) => design.canConnect(from, port);
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  pointer = toWorld(event);

  const port = portAt(design.nodes, pointer);
  if (port) {
    const start = design.portPoint(port);
    scene.draft = { from: port, rope: createRope(start, start), snap: null };
    gesture = { type: 'drawing-cable' };
    return;
  }

  const node = design.nodeAt(pointer);
  if (node) {
    design.bringToFront(node.id);
    scene.selection = { type: 'node', id: node.id };
    gesture = {
      type: 'moving-node',
      nodeId: node.id,
      grabOffset: { x: pointer.x - node.x, y: pointer.y - node.y },
      moved: false,
    };
    return;
  }

  const cable = design.cableAt(pointer);
  scene.selection = cable ? { type: 'cable', id: cable.id } : null;
  if (!cable) {
    gesture = { type: 'panning', last: { x: event.clientX, y: event.clientY } };
  }
});

canvas.addEventListener('pointermove', (event) => {
  pointer = toWorld(event);

  switch (gesture.type) {
    case 'moving-node':
      // Record once per drag, and only if it really moves, so a plain
      // click doesn't leave an empty undo step behind.
      if (!gesture.moved) undoHistory.record(design);
      gesture.moved = true;
      design.moveNode(gesture.nodeId, {
        x: pointer.x - gesture.grabOffset.x,
        y: pointer.y - gesture.grabOffset.y,
      });
      break;
    case 'drawing-cable':
      scene.draft!.snap = findSnapTarget(
        design.nodes,
        pointer,
        canPlugInto(scene.draft!.from),
      );
      break;
    case 'panning':
      scene.camera.x += event.clientX - gesture.last.x;
      scene.camera.y += event.clientY - gesture.last.y;
      gesture.last = { x: event.clientX, y: event.clientY };
      break;
  }

  updateHover();
});

canvas.addEventListener('pointerup', () => {
  const draft = scene.draft;
  if (
    gesture.type === 'drawing-cable' &&
    draft?.snap &&
    design.canConnect(draft.from, draft.snap)
  ) {
    undoHistory.record(design);
    const cable = design.connect(draft.from, draft.snap, {
      rope: draft.rope,
    });
    if (cable) scene.selection = { type: 'cable', id: cable.id };
  }
  scene.draft = null;
  gesture = { type: 'idle' };
  updateHover();
});

canvas.addEventListener('pointerleave', () => {
  if (gesture.type !== 'idle') return;
  scene.hoveredNodeId = null;
  scene.hoveredPort = null;
});

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const screenPoint = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    const factor = Math.exp(-event.deltaY * 0.0015);
    scene.camera = zoomAt(scene.camera, screenPoint, factor);
  },
  { passive: false },
);

canvas.addEventListener('dragover', (event) => {
  if (event.dataTransfer?.types.includes(DRAG_FORMAT)) event.preventDefault();
});

canvas.addEventListener('drop', (event) => {
  const kindId = event.dataTransfer?.getData(DRAG_FORMAT);
  if (!kindId) return;
  event.preventDefault();
  undoHistory.record(design);
  const node = design.addNode(kindId, toWorld(event));
  scene.selection = { type: 'node', id: node.id };
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  // Ctrl on Windows and Linux, Cmd on macOS.
  const shortcut = event.ctrlKey || event.metaKey;

  if (shortcut && key === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if (shortcut && key === 'c') {
    // Let the browser copy any text selected in the drawer.
    if (window.getSelection()?.toString()) return;
    if (copySelectedComponent()) event.preventDefault();
  } else if (shortcut && key === 'v') {
    if (!copied) return;
    event.preventDefault();
    pasteComponent();
  } else if (key === 'escape') {
    scene.draft = null;
    scene.selection = null;
    gesture = { type: 'idle' };
  } else if (key === 'delete' || key === 'backspace') {
    deleteSelection();
  }
});

function deleteSelection(): void {
  const selection = scene.selection;
  if (!selection) return;
  undoHistory.record(design);
  if (selection.type === 'node') design.removeNode(selection.id);
  else design.removeCable(selection.id);
  scene.selection = null;
}

function copySelectedComponent(): boolean {
  if (scene.selection?.type !== 'node') return false;
  const { kind, label, x, y } = design.getNode(scene.selection.id);
  copied = { kind, label, x, y };
  return true;
}

function pasteComponent(): void {
  if (!copied) return;
  // Move the stored copy too, so repeated pastes fan out in a diagonal.
  copied.x += PASTE_OFFSET;
  copied.y += PASTE_OFFSET;
  undoHistory.record(design);
  const position = { x: copied.x, y: copied.y };
  const node = design.addNode(copied.kind, position, copied.label);
  scene.selection = { type: 'node', id: node.id };
}

function undo(): void {
  if (!undoHistory.undo(design)) return;
  scene.draft = null;
  gesture = { type: 'idle' };
  const selection = scene.selection;
  const stillThere =
    selection?.type === 'node'
      ? design.nodes.some((node) => node.id === selection.id)
      : design.cables.some((cable) => cable.id === selection?.id);
  if (!stillThere) scene.selection = null;
}

function updateHover(): void {
  const port = portAt(design.nodes, pointer);
  scene.hoveredPort = port;
  scene.hoveredNodeId = port?.nodeId ?? design.nodeAt(pointer)?.id ?? null;
  canvas.style.cursor = cursorFor(port !== null);
}

function cursorFor(overPort: boolean): string {
  if (gesture.type === 'drawing-cable' || overPort) return 'crosshair';
  if (gesture.type === 'moving-node' || gesture.type === 'panning') {
    return 'grabbing';
  }
  return scene.hoveredNodeId ? 'grab' : 'default';
}

flowToggle.checked = scene.flow.enabled;
flowToggle.addEventListener('change', () => {
  scene.flow.enabled = flowToggle.checked;
});

function frame(now: number): void {
  scene.time = now / 1000;
  design.step();
  if (scene.draft) {
    const { from, snap, rope } = scene.draft;
    const end = snap ? design.portPoint(snap) : pointer;
    stepRope(rope, design.portPoint(from), end);
  }
  syncDrawer();
  render(ctx, scene, boardSize());
  requestAnimationFrame(frame);
}

resize();
openTemplate(decodeURIComponent(location.hash.slice(1)));
requestAnimationFrame(frame);
