import { CATEGORIES, COMPONENT_KINDS } from './components.ts';

export const DRAG_FORMAT = 'application/x-system-component';

export function renderPalette(
  container: HTMLElement,
  onPick: (kindId: string) => void,
): void {
  for (const category of CATEGORIES) {
    const group = document.createElement('section');
    group.className = 'palette-group';
    group.style.setProperty('--color', category.color);
    group.append(heading(category.label));

    const kinds = COMPONENT_KINDS.filter(
      (kind) => kind.category === category.id,
    );
    for (const kind of kinds) {
      const item = document.createElement('button');
      item.className = 'palette-item';
      item.draggable = true;
      item.title = `Drag onto the board, or click to add ${kind.label}`;
      item.innerHTML = `<span class="badge"></span><span></span>`;
      item.children[0].textContent = kind.badge;
      item.children[1].textContent = kind.label;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData(DRAG_FORMAT, kind.id);
      });
      item.addEventListener('click', () => onPick(kind.id));
      group.append(item);
    }

    container.append(group);
  }
}

function heading(text: string): HTMLElement {
  const element = document.createElement('h2');
  element.textContent = text;
  return element;
}
