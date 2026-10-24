import { element } from './dom.ts';
import content from './nutshell.json' with { type: 'json' };

export interface NutshellItem {
  title?: string;
  text: string;
}

/** A common problem, its usual first answer and the board that shows it. */
export interface NutshellSignal {
  signal: string;
  answer: string;
  foundation: string;
}

export interface NutshellSection {
  heading: string;
  ordered?: boolean;
  items?: NutshellItem[];
  map?: NutshellSignal[];
}

export const NUTSHELL: {
  title: string;
  lede: string;
  sections: NutshellSection[];
} = content;

/** The whole framework as one page; signals link to their Foundation. */
export function renderNutshell(
  container: HTMLElement,
  openFoundation: (id: string, from: HTMLElement) => void,
): void {
  container.replaceChildren(
    element('h2', 'nutshell-title', NUTSHELL.title),
    element('p', 'nutshell-lede', NUTSHELL.lede),
    ...NUTSHELL.sections.map((section) => renderSection(section)),
  );

  function renderSection({ heading, ordered, items, map }: NutshellSection) {
    const wrapper = element('section', 'nutshell-section');
    wrapper.append(element('h3', '', heading));
    if (items) {
      const list = element(ordered ? 'ol' : 'ul');
      list.append(...items.map(renderItem));
      wrapper.append(list);
    }
    if (map) wrapper.append(renderMap(map));
    return wrapper;
  }

  function renderMap(signals: NutshellSignal[]): HTMLElement {
    const list = element('ul', 'nutshell-map');
    for (const { signal, answer, foundation } of signals) {
      const link = element('button', 'nutshell-signal');
      link.append(
        element('span', 'nutshell-signal-name', signal),
        element('span', '', answer),
      );
      link.title = 'Open this Foundation board';
      link.addEventListener('click', () => openFoundation(foundation, link));
      const row = element('li');
      row.append(link);
      list.append(row);
    }
    return list;
  }
}

function renderItem({ title, text }: NutshellItem): HTMLElement {
  const item = element('li');
  if (title) item.append(element('strong', '', title), ' ');
  item.append(text);
  return item;
}
