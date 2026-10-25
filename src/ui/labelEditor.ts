import type { Point } from '../model/geometry.ts';

/** Something on the board that can be named in place. */
export interface LabelTarget {
  text: string;
  placeholder: string;
  /** Where the field sits, in board units; null once the thing is gone. */
  position(): Point | null;
  save(text: string): void;
}

export interface LabelEditor {
  open(target: LabelTarget): void;
  /** Keeps the field over its target while the board or a rope moves. */
  follow(): void;
}

/** A small text field floating over the board, for naming things. */
export function createLabelEditor(options: {
  input: HTMLInputElement;
  toScreen: (world: Point) => Point;
}): LabelEditor {
  const { input, toScreen } = options;
  let target: LabelTarget | null = null;

  function open(next: LabelTarget): void {
    target = next;
    input.value = next.text;
    input.placeholder = next.placeholder;
    input.ariaLabel = next.placeholder;
    input.hidden = false;
    follow();
    input.focus();
    input.select();
  }

  function close(save: boolean): void {
    if (!target) return;
    const closing = target;
    target = null;
    input.hidden = true;
    if (save) closing.save(input.value);
  }

  function follow(): void {
    if (!target) return;
    const position = target.position();
    // The thing may have been deleted or undone while the field was open.
    if (!position) return close(false);
    const { x, y } = toScreen(position);
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
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
