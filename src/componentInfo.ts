import { CATEGORIES, type ComponentKind, type Sample } from './components.ts';
import { element, list, section } from './dom.ts';

/** Explains a component in plain words: what it is, why, and examples. */
export function renderComponentInfo(
  container: HTMLElement,
  kind: ComponentKind,
  customLabel?: string,
): void {
  const category = CATEGORIES.find(({ id }) => id === kind.category)!;
  const badge = element('span', 'badge', kind.badge);
  badge.style.setProperty('--color', category.color);

  const titles = element('div');
  titles.append(
    element('p', 'eyebrow', `${category.label} component`),
    element('h2', 'drawer-title', customLabel ?? kind.label),
  );
  if (customLabel) titles.append(element('p', 'drawer-subtitle', kind.label));

  const header = element('header', 'component-header');
  header.append(badge, titles);

  container.replaceChildren(
    header,
    element('p', 'drawer-lede', kind.info.what),
    section('Why use it', [element('p', '', kind.info.why)]),
    section('Think of it as', [element('p', '', kind.info.analogy)]),
    section('Popular choices', [list(kind.info.examples, 'chips')]),
  );

  const samples = kind.info.samples ?? [];
  if (samples.length > 0) {
    container.append(section('What it looks like', samples.map(renderSample)));
  }
}

function renderSample(sample: Sample): HTMLElement {
  const caption = element('figcaption');
  caption.append(element('span', '', sample.caption));
  // A quiet language tag, so readers know what kind of snippet it is.
  if (sample.type === 'code') {
    caption.append(element('span', 'sample-language', sample.language));
  }
  const body =
    sample.type === 'table' ? renderTable(sample) : renderCode(sample);
  const figure = element('figure', 'sample');
  figure.append(caption, body);
  return figure;
}

function renderTable(sample: Extract<Sample, { type: 'table' }>) {
  const table = document.createElement('table');
  const headerRow = table.createTHead().insertRow();
  for (const column of sample.columns) {
    headerRow.append(element('th', '', column));
  }
  const body = table.createTBody();
  for (const row of sample.rows) {
    const tableRow = body.insertRow();
    for (const value of row) tableRow.insertCell().textContent = value;
  }
  // Wide tables scroll sideways instead of stretching the drawer.
  const scroller = element('div', 'sample-scroll');
  scroller.append(table);
  return scroller;
}

function renderCode(sample: Extract<Sample, { type: 'code' }>) {
  const pre = element('pre', 'sample-scroll');
  pre.append(element('code', '', sample.code));
  return pre;
}
