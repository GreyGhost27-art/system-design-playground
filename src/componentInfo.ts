import { CATEGORIES, type ComponentKind } from './components.ts';
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
}
