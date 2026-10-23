import { fitCamera, screenToWorld, zoomAt } from './camera.ts';
import { Design, type PortRef } from './design.ts';
import type { Point } from './geometry.ts';
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
  | { type: 'moving-node'; nodeId: string; grabOffset: Point }
  | { type: 'drawing-cable' }
  | { type: 'panning'; last: Point };

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const ctx = canvas.getContext('2d')!;
const palette = document.querySelector<HTMLElement>('#palette')!;
const templateSelect =
  document.querySelector<HTMLSelectElement>('#template-select')!;
const lessonPanel = document.querySelector<HTMLElement>('#lesson')!;
const lessonContent = document.querySelector<HTMLElement>('#lesson-content')!;
const lessonOpenButton = document.querySelector<HTMLElement>('#lesson-open')!;
const lessonCloseButton = document.querySelector<HTMLElement>('#lesson-close')!;
const copyJsonButton = document.querySelector<HTMLElement>('#copy-json')!;
const flowToggle = document.querySelector<HTMLInputElement>('#flow-toggle')!;

// Space the lesson panel covers on the right of the board when open.
const LESSON_PANEL_SPACE = 372;
// Physics steps run before showing a template, so cables appear settled.
const SETTLE_STEPS = 90;

const design = new Design();
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
  if (currentTemplate) loadTemplate(design, currentTemplate);
  else design.clear();
  for (let i = 0; i < SETTLE_STEPS; i++) design.step();

  if (currentTemplate) {
    renderLesson(lessonContent, currentTemplate, {
      number: TEMPLATES.indexOf(currentTemplate) + 1,
      total: TEMPLATES.length,
    });
  }
  updateLessonVisibility();
  history.replaceState(null, '', currentTemplate ? `#${id}` : '#');
  fitToDesign();
}

function updateLessonVisibility(): void {
  lessonPanel.hidden = !currentTemplate || !lessonOpen;
  lessonOpenButton.hidden = !currentTemplate || lessonOpen;
}

function fitToDesign(): void {
  const bounds = design.bounds();
  if (!bounds) {
    scene.camera = { x: 0, y: 0, scale: 1 };
    return;
  }
  const { width, height } = boardSize();
  const covered = lessonPanel.hidden ? 0 : LESSON_PANEL_SPACE;
  scene.camera = fitCamera(bounds, { width: width - covered, height }, 48);
}

templateSelect.addEventListener('change', () => {
  openTemplate(templateSelect.value);
  templateSelect.blur();
});

lessonCloseButton.addEventListener('click', () => setLessonOpen(false));
lessonOpenButton.addEventListener('click', () => setLessonOpen(true));

function setLessonOpen(open: boolean): void {
  lessonOpen = open;
  updateLessonVisibility();
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
  if (gesture.type === 'drawing-cable' && draft?.snap) {
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
  const node = design.addNode(kindId, toWorld(event));
  scene.selection = { type: 'node', id: node.id };
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLSelectElement) return;
  if (event.key === 'Escape') {
    scene.draft = null;
    scene.selection = null;
    gesture = { type: 'idle' };
  }
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  const selection = scene.selection;
  if (selection?.type === 'node') design.removeNode(selection.id);
  if (selection?.type === 'cable') design.removeCable(selection.id);
  scene.selection = null;
});

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
  render(ctx, scene, boardSize());
  requestAnimationFrame(frame);
}

resize();
openTemplate(decodeURIComponent(location.hash.slice(1)));
requestAnimationFrame(frame);
