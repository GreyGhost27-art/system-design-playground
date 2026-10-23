import type { Design } from './design.ts';
import type { Point } from './geometry.ts';

export interface CableLabelEditor {
  open(cableId: string): void;
  /** Keeps the field over the cable's middle while the rope swings. */
  follow(): void;
}

/** A small text field floating over a cable, for naming it. */
export function createCableLabelEditor(options: {
  input: HTMLInputElement;
  design: Design;
  toScreen: (world: Point) => Point;
  onSave: (cableId: string, label: string) => void;
}): CableLabelEditor {
  const { input, design, toScreen, onSave } = options;
  let cableId: string | null = null;

  const findCable = () => design.cables.find((cable) => cable.id === cableId);

  function open(id: string): void {
    cableId = id;
    const cable = findCable();
    if (!cable) return close(false);
    input.value = cable.label ?? '';
    input.hidden = false;
    follow();
    input.focus();
    input.select();
  }

  function close(save: boolean): void {
    if (cableId === null) return;
    const id = cableId;
    cableId = null;
    input.hidden = true;
    if (save) onSave(id, input.value);
  }

  function follow(): void {
    if (cableId === null) return;
    const cable = findCable();
    // The cable may have been deleted or undone while the field was open.
    if (!cable) return close(false);
    const { points } = cable.rope;
    const middle = toScreen(points[Math.floor(points.length / 2)]);
    input.style.left = `${middle.x}px`;
    input.style.top = `${middle.y}px`;
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') close(true);
    if (event.key === 'Escape') close(false);
    // Typing must not reach the board's shortcuts (Delete, Ctrl+Z…).
    event.stopPropagation();
  });
  input.addEventListener('blur', () => close(true));

  return { open, follow };
}
