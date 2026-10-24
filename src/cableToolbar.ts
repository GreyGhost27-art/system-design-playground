import type { Design } from './design.ts';
import type { Point } from './geometry.ts';

export interface CableActions {
  setOneWay(cableId: string, oneWay: boolean): void;
  flip(cableId: string): void;
  label(cableId: string): void;
  remove(cableId: string): void;
}

/** Buttons floating above the selected cable; big enough for touch. */
export function createCableToolbar(options: {
  element: HTMLElement;
  design: Design;
  toScreen: (world: Point) => Point;
  actions: CableActions;
}): { show(cableId: string | null): void } {
  const { element, design, toScreen, actions } = options;
  const twoWayButton = button('two-way');
  const oneWayButton = button('one-way');
  let cableId: string | null = null;

  element.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-action]',
    )?.dataset.action;
    if (!cableId || !action) return;
    if (action === 'two-way') actions.setOneWay(cableId, false);
    if (action === 'one-way') actions.setOneWay(cableId, true);
    if (action === 'flip') actions.flip(cableId);
    if (action === 'label') actions.label(cableId);
    if (action === 'delete') actions.remove(cableId);
  });

  /** Call every frame, so the toolbar follows the rope as it swings. */
  function show(id: string | null): void {
    const cable = design.cables.find((candidate) => candidate.id === id);
    cableId = cable?.id ?? null;
    element.hidden = !cable;
    if (!cable) return;
    const { points } = cable.rope;
    const middle = toScreen(points[Math.floor(points.length / 2)]);
    element.style.left = `${middle.x}px`;
    element.style.top = `${middle.y}px`;
    twoWayButton.ariaPressed = String(!cable.oneWay);
    oneWayButton.ariaPressed = String(Boolean(cable.oneWay));
  }

  function button(action: string): HTMLElement {
    return element.querySelector<HTMLElement>(`[data-action="${action}"]`)!;
  }

  return { show };
}
