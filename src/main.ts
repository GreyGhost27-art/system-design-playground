import { fitCamera, screenToWorld, worldToScreen, zoomAt } from './camera.ts';
import { renderComponentInfo } from './componentInfo.ts';
import { findKind } from './components.ts';
import { Design, NODE_HEIGHT, type PortRef } from './design.ts';
import type { Point } from './geometry.ts';
import { UndoHistory } from './history.ts';
import { createCableToolbar } from './cableToolbar.ts';
import { createCableLabelEditor } from './labelEditor.ts';
import { renderLesson } from './lesson.ts';
import { renderNutshell } from './nutshell.ts';
import { DRAG_FORMAT, renderPalette } from './palette.ts';
import { render, type CableDraft, type Scene } from './render.ts';
import { createWheelPlacement, layoutRadialMenu } from './radialMenu.ts';
import { createRope, reverseRope, stepRope } from './rope.ts';
import settings from './settings.json' with { type: 'json' };
import { findSnapTarget, portAt } from './snap.ts';
import { SECTIONS, type TemplateSection } from './templateLibrary.ts';
import { loadTemplate, toTemplate, type Template } from './templates.ts';

type Gesture =
  | { type: 'idle' }
  | { type: 'moving-node'; nodeId: string; grabOffset: Point; moved: boolean }
  | { type: 'drawing-cable' }
  | {
      type: 'holding-cable-end';
      cableId: string;
      end: 'from' | 'to';
      start: Point;
    }
  | {
      type: 'moving-group';
      index: number;
      // Captured when grabbed, so components it passes over stay behind.
      nodeIds: string[];
      last: Point;
      moved: boolean;
    }
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
const labelInput = document.querySelector<HTMLInputElement>('#label-editor')!;
const menuToggle = document.querySelector<HTMLElement>('#menu-toggle')!;
const menuBackdrop = document.querySelector<HTMLElement>('#menu-backdrop')!;
const blankBoardButton = document.querySelector<HTMLElement>('#blank-board')!;
const backToNutshellButton =
  document.querySelector<HTMLElement>('#back-to-nutshell')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const nodeToolbar = document.querySelector<HTMLElement>('#node-toolbar')!;
layoutRadialMenu(nodeToolbar);
const placeNodeWheel = createWheelPlacement(nodeToolbar.children.length);
const nodeInfoButton = nodeToolbar.querySelector<HTMLElement>(
  '[data-action="info"]',
)!;
const nutshell = document.querySelector<HTMLElement>('#nutshell')!;
const nutshellOpenButton =
  document.querySelector<HTMLElement>('#nutshell-open')!;
const nutshellCloseButton =
  document.querySelector<HTMLElement>('#nutshell-close')!;
const toastUndoButton = document.querySelector<HTMLElement>('#toast-undo')!;
const cableToolbarElement =
  document.querySelector<HTMLElement>('#cable-toolbar')!;

// Space the drawer covers on the right of the board when open.
const DRAWER_SPACE = 472;
// Gap between the drawer and the bottom of the board on phones.
const DRAWER_GAP = 8;
// Physics steps run before showing a template, so cables appear settled.
const SETTLE_STEPS = 90;
// Each paste lands this far down and right of the last copy.
const PASTE_OFFSET = 40;
// Each tap on a zoom button zooms this much.
const ZOOM_STEP = 1.25;
// How long the "Board cleared" message offers its Undo button.
const TOAST_MS = 6000;
// Holding still on a cable this long (touch screens) opens its label field.
const LONG_PRESS_MS = 500;
// Pointer travel (screen pixels) that turns a press into a drag.
const DRAG_SLOP = 6;

const design = new Design();
const undoHistory = new UndoHistory();
const scene: Scene = {
  design,
  camera: { x: 0, y: 0, scale: 1 },
  selection: null,
  hoveredNodeId: null,
  hoveredGroup: null,
  hoveredPort: null,
  draft: null,
  flow: { ...settings.flow },
  time: 0,
};
let gesture: Gesture = { type: 'idle' };
let pointer: Point = { x: 0, y: 0 };
let currentTemplate: Template | null = null;
let currentSection: TemplateSection | null = null;
let lessonOpen = true;
// What the drawer currently shows, so it is only rebuilt when that changes.
let drawerShowing = '';
let copied: { kind: string; label?: string; x: number; y: number } | null =
  null;
let longPress: { timer: number; start: Point } | null = null;
let toastTimer = 0;
// Where the pointer last pressed on the board (world units), so a wheel
// opens clear of it. Presses elsewhere, like the sidebar, don't count.
let lastPress: Point | null = null;
// The component whose explanation was asked for (Info or double-click).
let infoRequestedFor: string | null = null;
// The Nutshell row a board was opened from, to land back on it.
let nutshellReturnRow: HTMLElement | null = null;

const labelEditor = createCableLabelEditor({
  input: labelInput,
  design,
  toScreen: (world) => worldToScreen(scene.camera, world),
  onSave: (cableId, label) => {
    const cable = design.cables.find((candidate) => candidate.id === cableId);
    if (!cable || (cable.label ?? '') === label.trim()) return;
    undoHistory.record(design);
    design.setCableLabel(cableId, label);
  },
});

const cableToolbar = createCableToolbar({
  element: cableToolbarElement,
  design,
  toScreen: (world) => worldToScreen(scene.camera, world),
  actions: {
    setOneWay: (cableId, oneWay) => {
      if (Boolean(design.getCable(cableId).oneWay) === oneWay) return;
      undoHistory.record(design);
      design.setCableOneWay(cableId, oneWay);
    },
    flip: (cableId) => {
      undoHistory.record(design);
      design.flipCable(cableId);
    },
    label: (cableId) => labelEditor.open(cableId),
    remove: () => deleteSelection(),
  },
});

renderPalette(palette, (kindId) => {
  setNutshellOpen(false);
  addAtViewCenter(kindId);
});
fillTemplateSelect();
renderNutshell(document.querySelector('#nutshell-content')!, (id, row) => {
  nutshellReturnRow = row;
  // A real history step, so the browser's Back button returns here too.
  history.pushState(null, '', `#${id}`);
  setNutshellOpen(false);
  openTemplate(id);
});

backToNutshellButton.addEventListener('click', () => history.back());

// Phones have no scroll wheel, so zooming gets buttons there.
document.querySelector('.zoom-controls')!.addEventListener('click', (event) => {
  const zoom = (event.target as HTMLElement).closest<HTMLElement>('[data-zoom]')
    ?.dataset.zoom;
  if (zoom === 'fit') return fitToDesign();
  if (!zoom) return;
  const { width, height } = visibleBoardSize();
  const factor = zoom === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP;
  const center = { x: width / 2, y: height / 2 };
  scene.camera = zoomAt(scene.camera, center, factor);
});

window.addEventListener('popstate', () => {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash === 'nutshell') {
    setNutshellOpen(true);
    nutshellReturnRow?.scrollIntoView({ block: 'center' });
    nutshellReturnRow?.focus({ preventScroll: true });
    nutshellReturnRow = null;
    return;
  }
  setNutshellOpen(false);
  if (hash !== (currentTemplate?.id ?? '')) openTemplate(hash);
});

function fillTemplateSelect(): void {
  templateSelect.append(new Option('Blank board', ''));
  for (const { name, templates } of SECTIONS) {
    const group = document.createElement('optgroup');
    group.label = name;
    templates.forEach((template, index) => {
      group.append(new Option(`${index + 1}. ${template.title}`, template.id));
    });
    templateSelect.append(group);
  }
}

/**
 * Opens a template, or a blank board when `id` matches none. Only
 * clearing can be undone: undoing into an old board under a new template's
 * lesson would be confusing.
 */
function openTemplate(id: string): void {
  currentSection =
    SECTIONS.find(({ templates }) =>
      templates.some((candidate) => candidate.id === id),
    ) ?? null;
  currentTemplate =
    currentSection?.templates.find((template) => template.id === id) ?? null;
  templateSelect.value = currentTemplate?.id ?? '';
  scene.selection = null;
  if (currentTemplate) {
    undoHistory.clear();
    loadTemplate(design, currentTemplate);
  } else {
    if (design.nodes.length > 0) {
      undoHistory.record(design);
      showToast();
    }
    design.clear();
  }
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
  const node = nodeToExplain();
  const showLesson = !node && currentTemplate !== null && lessonOpen;
  const showing = node
    ? `node:${node.id}:${node.label ?? ''}`
    : showLesson
      ? `lesson:${currentTemplate!.id}`
      : '';

  lessonOpenButton.hidden =
    !currentTemplate || lessonOpen || scene.selection?.type === 'node';
  if (showing === drawerShowing) return;
  drawerShowing = showing;
  drawer.hidden = showing === '';

  if (node) {
    renderComponentInfo(drawerContent, findKind(node.kind), node.label);
  } else if (showLesson) {
    renderLesson(drawerContent, currentTemplate!, currentSection!);
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
  scene.camera = fitCamera(bounds, visibleBoardSize(), 48);
}

templateSelect.addEventListener('change', () => {
  setNutshellOpen(false);
  openTemplate(templateSelect.value);
  templateSelect.blur();
});

/** On phones the sidebar slides in over the board. */
function setMenuOpen(open: boolean): void {
  document.body.classList.toggle('menu-open', open);
  menuToggle.ariaExpanded = String(open);
}
menuToggle.addEventListener('click', () =>
  setMenuOpen(!document.body.classList.contains('menu-open')),
);
menuBackdrop.addEventListener('click', () => setMenuOpen(false));

/** The Nutshell page covers the board; its address is #nutshell. */
function setNutshellOpen(open: boolean): void {
  nutshell.hidden = !open;
  nutshellOpenButton.ariaPressed = String(open);
  setMenuOpen(false);
  const boardHash = currentTemplate ? `#${currentTemplate.id}` : '#';
  history.replaceState(null, '', open ? '#nutshell' : boardHash);
  if (open) nutshell.scrollTop = 0;
}
nutshellOpenButton.addEventListener('click', () =>
  setNutshellOpen(nutshell.hidden),
);
nutshellCloseButton.addEventListener('click', () => setNutshellOpen(false));

blankBoardButton.addEventListener('click', () => {
  setNutshellOpen(false);
  openTemplate('');
});

/** "Board cleared", with a way back instead of an "Are you sure?". */
function showToast(): void {
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, TOAST_MS);
}

function hideToast(): void {
  toast.hidden = true;
}

toastUndoButton.addEventListener('click', () => {
  undo();
  fitToDesign();
});

/**
 * The selected component, if its explanation was asked for. Selecting
 * alone doesn't open the drawer, so it never covers what you're arranging.
 */
function nodeToExplain() {
  const selection = scene.selection;
  if (selection?.type !== 'node' || infoRequestedFor !== selection.id) {
    return null;
  }
  return design.getNode(selection.id);
}

/**
 * Info is asked for one selection only. Once anything else is selected the
 * request is forgotten, so clicking that component again later just selects
 * it instead of reopening the drawer.
 */
function forgetInfoOnceDeselected(): void {
  const selection = scene.selection;
  const selectedNodeId = selection?.type === 'node' ? selection.id : null;
  if (infoRequestedFor !== selectedNodeId) infoRequestedFor = null;
}

function setInfoOpen(nodeId: string | null): void {
  infoRequestedFor = nodeId;
  syncDrawer();
}

drawerCloseButton.addEventListener('click', () => {
  // Closing a component's explanation falls back to the lesson; the
  // component stays selected, with Info ready to reopen it.
  if (nodeToExplain()) setInfoOpen(null);
  else setLessonOpen(false);
});

nodeToolbar.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-action]',
  )?.dataset.action;
  const selection = scene.selection;
  if (selection?.type !== 'node') return;
  if (action === 'info') setInfoOpen(nodeToExplain() ? null : selection.id);
  if (action === 'duplicate' && copySelectedComponent()) pasteComponent();
  if (action === 'delete') deleteSelection();
});

for (const type of ['pointerdown', 'pointerup'] as const) {
  document.addEventListener(
    type,
    (event) => {
      const onBoard = (event.target as Element).closest('.board') !== null;
      lastPress = onBoard ? toWorld(event) : null;
    },
    { capture: true },
  );
}

function pressOnScreen(): Point | null {
  return lastPress && worldToScreen(scene.camera, lastPress);
}

/** Fans the component's options out above it while it sits still. */
function syncNodeToolbar(): void {
  const selection = scene.selection;
  const show = selection?.type === 'node' && gesture.type === 'idle';
  nodeToolbar.hidden = !show;
  if (!show) {
    placeNodeWheel(null, { x: 0, y: 0 }, null);
    return;
  }
  const node = design.getNode(selection.id);
  // The wheel's centre sits just above the component, so the fan clears it.
  const top = { x: node.x, y: node.y - NODE_HEIGHT / 2 - 6 };
  const target = worldToScreen(scene.camera, top);
  const { x, y } = placeNodeWheel(node.id, target, pressOnScreen());
  nodeToolbar.style.left = `${x}px`;
  nodeToolbar.style.top = `${y}px`;
  nodeInfoButton.ariaPressed = String(nodeToExplain() !== null);
}
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

/**
 * The part of the board the drawer leaves uncovered: it sits on the right,
 * or along the bottom on phones (where the menu button shows).
 */
function visibleBoardSize(): { width: number; height: number } {
  const { width, height } = boardSize();
  if (drawer.hidden) return { width, height };
  return isPhoneLayout()
    ? { width, height: height - drawer.offsetHeight - DRAWER_GAP }
    : { width: width - DRAWER_SPACE, height };
}

/** Phones get the menu button, the bottom sheet and tap-for-info. */
function isPhoneLayout(): boolean {
  return menuToggle.offsetParent !== null;
}

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
  const { width, height } = visibleBoardSize();
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
  // Shift-dragging a port picks up its newest cable instead of a new one.
  const newestCable = port && design.cablesAtPort(port).at(-1);
  if (event.shiftKey && port && newestCable) {
    const end = newestCable.from.nodeId === port.nodeId ? 'from' : 'to';
    unplug(newestCable.id, end);
    return;
  }
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
  if (cable) {
    const grabbed = design.cableEndAt(pointer);
    if (grabbed) {
      gesture = {
        type: 'holding-cable-end',
        cableId: grabbed.cable.id,
        end: grabbed.end,
        start: { x: event.clientX, y: event.clientY },
      };
    }
    longPress = {
      timer: window.setTimeout(() => labelEditor.open(cable.id), LONG_PRESS_MS),
      start: { x: event.clientX, y: event.clientY },
    };
    return;
  }

  const groupIndex = design.groupHandleAt(pointer);
  if (groupIndex >= 0) {
    gesture = {
      type: 'moving-group',
      index: groupIndex,
      nodeIds: design.nodesTouching(groupIndex).map((node) => node.id),
      last: pointer,
      moved: false,
    };
    return;
  }
  gesture = { type: 'panning', last: { x: event.clientX, y: event.clientY } };
});

function cancelLongPress(): void {
  if (longPress) window.clearTimeout(longPress.timer);
  longPress = null;
}

canvas.addEventListener('dblclick', (event) => {
  cancelLongPress();
  const point = toWorld(event);
  const node = design.nodeAt(point);
  if (node) return setInfoOpen(node.id);
  const cable = design.cableAt(point);
  if (cable) labelEditor.open(cable.id);
});

canvas.addEventListener('pointermove', (event) => {
  pointer = toWorld(event);
  if (longPress) {
    const moved = Math.hypot(
      event.clientX - longPress.start.x,
      event.clientY - longPress.start.y,
    );
    if (moved > DRAG_SLOP) cancelLongPress();
  }
  if (gesture.type === 'holding-cable-end') {
    const { start, cableId, end } = gesture;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > DRAG_SLOP) unplug(cableId, end);
  }

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
    case 'moving-group': {
      if (!gesture.moved) undoHistory.record(design);
      gesture.moved = true;
      const delta = {
        x: pointer.x - gesture.last.x,
        y: pointer.y - gesture.last.y,
      };
      design.moveGroup(gesture.index, delta, gesture.nodeIds);
      gesture.last = pointer;
      break;
    }
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
  cancelLongPress();
  const draft = scene.draft;
  if (
    gesture.type === 'drawing-cable' &&
    draft?.snap &&
    design.canConnect(draft.from, draft.snap)
  ) {
    const cable = plugIn(draft, draft.snap);
    if (cable) scene.selection = { type: 'cable', id: cable.id };
  }
  scene.draft = null;
  gesture = { type: 'idle' };
  updateHover();
});

/** Pulls one end of a cable out; the cable then follows the pointer. */
function unplug(cableId: string, end: 'from' | 'to'): void {
  cancelLongPress();
  const cable = design.cables.find((candidate) => candidate.id === cableId);
  if (!cable) return;
  undoHistory.record(design);
  design.removeCable(cableId);
  // The draft always grows from the end that stays plugged in.
  const reversed = end === 'from';
  if (reversed) reverseRope(cable.rope);
  scene.draft = {
    from: reversed ? cable.to : cable.from,
    rope: cable.rope,
    snap: null,
    unplugged: { label: cable.label, oneWay: cable.oneWay, reversed },
  };
  scene.selection = null;
  gesture = { type: 'drawing-cable' };
}

function plugIn(draft: CableDraft, target: PortRef) {
  const { unplugged, rope } = draft;
  if (!unplugged) {
    undoHistory.record(design);
    return design.connect(draft.from, target, { rope });
  }
  // A re-plugged cable keeps the way round it was drawn, so its traffic
  // still flows the same direction. Unplugging already recorded an undo step.
  if (unplugged.reversed) reverseRope(rope);
  const [from, to] = unplugged.reversed
    ? [target, draft.from]
    : [draft.from, target];
  const { label, oneWay } = unplugged;
  return design.connect(from, to, { rope, label, oneWay });
}

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
  // The board is hidden behind the Nutshell page, so leave it alone.
  if (!nutshell.hidden) {
    if (key === 'escape') setNutshellOpen(false);
    return;
  }
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
    setMenuOpen(false);
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
  hideToast();
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
  const overCableEnd =
    !scene.hoveredNodeId && design.cableEndAt(pointer) !== null;
  const groupIndex =
    gesture.type === 'moving-group'
      ? gesture.index
      : !scene.hoveredNodeId && !overCableEnd
        ? design.groupHandleAt(pointer)
        : -1;
  scene.hoveredGroup = groupIndex >= 0 ? groupIndex : null;
  const grabbable =
    scene.hoveredNodeId !== null || overCableEnd || groupIndex >= 0;
  canvas.style.cursor = cursorFor(port !== null, grabbable);
}

function cursorFor(overPort: boolean, grabbable: boolean): string {
  if (gesture.type === 'drawing-cable' || overPort) return 'crosshair';
  if (gesture.type !== 'idle') return 'grabbing';
  return grabbable ? 'grab' : 'default';
}

flowToggle.checked = scene.flow.enabled;
flowToggle.addEventListener('change', () => {
  scene.flow.enabled = flowToggle.checked;
});

/** Shown for a selected cable, unless it is being dragged or labelled. */
function syncCableToolbar(): void {
  const selection = scene.selection;
  const busy = gesture.type !== 'idle' || !labelInput.hidden;
  const cableId = selection?.type === 'cable' && !busy ? selection.id : null;
  cableToolbar.show(cableId, pressOnScreen());
}

function frame(now: number): void {
  scene.time = now / 1000;
  design.step();
  if (scene.draft) {
    const { from, snap, rope } = scene.draft;
    const end = snap ? design.portPoint(snap) : pointer;
    stepRope(rope, design.portPoint(from), end);
  }
  forgetInfoOnceDeselected();
  syncDrawer();
  labelEditor.follow();
  syncCableToolbar();
  syncNodeToolbar();
  // Nothing to clear on a blank board that is already showing.
  blankBoardButton.hidden = !currentTemplate && design.nodes.length === 0;
  backToNutshellButton.hidden = !nutshellReturnRow;
  render(ctx, scene, boardSize());
  requestAnimationFrame(frame);
}

resize();
const startHash = decodeURIComponent(location.hash.slice(1));
openTemplate(startHash);
if (startHash === 'nutshell') setNutshellOpen(true);
requestAnimationFrame(frame);
