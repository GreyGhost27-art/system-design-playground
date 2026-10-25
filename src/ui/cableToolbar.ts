import type { Design } from '../model/design.ts';
import type { Point } from '../model/geometry.ts';
import { createWheelPlacement, layoutRadialMenu } from './radialMenu.ts';

export interface CableActions {
  setOneWay(cableId: string, oneWay: boolean): void;
  flip(cableId: string): void;
  label(cableId: string): void;
  remove(cableId: string): void;
}

/** A wheel of options over the selected cable's middle. */
export function createCableToolbar(options: {
  element: HTMLElement;
  design: Design;
  toScreen: (world: Point) => Point;
  actions: CableActions;
}): { show(cableId: string | null, press: Point | null): void } {
  const { element, design, toScreen, actions } = options;
  layoutRadialMenu(element);
  const place = createWheelPlacement(element.children.length);
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

  /**
   * Call every frame, so the wheel follows the rope as it swings. `press`
   * is where the pointer last pressed, in screen pixels.
   */
  function show(id: string | null, press: Point | null): void {
    const cable = design.cables.find((candidate) => candidate.id === id);
    cableId = cable?.id ?? null;
    element.hidden = !cable;
    if (!cable) {
      place(null, { x: 0, y: 0 }, null);
      return;
    }
    const { points } = cable.rope;
    const middle = toScreen(points[Math.floor(points.length / 2)]);
    const center = place(cable.id, middle, press);
    element.style.left = `${center.x}px`;
    element.style.top = `${center.y}px`;
    twoWayButton.ariaPressed = String(!cable.oneWay);
    oneWayButton.ariaPressed = String(Boolean(cable.oneWay));
  }

  function button(action: string): HTMLElement {
    return element.querySelector<HTMLElement>(`[data-action="${action}"]`)!;
  }

  return { show };
}
