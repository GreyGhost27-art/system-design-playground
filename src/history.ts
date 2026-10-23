import type { Design, DesignSnapshot } from './design.ts';

const MAX_STEPS = 100;

/** Undo steps for a design. Call `record` just before changing it. */
export class UndoHistory {
  private past: DesignSnapshot[] = [];

  record(design: Design): void {
    this.past.push(design.snapshot());
    if (this.past.length > MAX_STEPS) this.past.shift();
  }

  /** Puts the design back as it was before the last change, if any. */
  undo(design: Design): boolean {
    const previous = this.past.pop();
    if (!previous) return false;
    design.restore(previous);
    return true;
  }

  clear(): void {
    this.past = [];
  }
}
