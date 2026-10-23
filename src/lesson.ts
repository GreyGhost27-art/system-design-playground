import { element, list, section } from './dom.ts';
import type { Template } from './templates.ts';

export function renderLesson(
  container: HTMLElement,
  template: Template,
  position: { number: number; total: number },
): void {
  const { lesson } = template;
  container.replaceChildren(
    element('p', 'eyebrow', `Template ${position.number} of ${position.total}`),
    element('h2', 'drawer-title', template.title),
    element('p', 'drawer-subtitle', template.summary),
    section('The problem', [element('p', '', lesson.problem)]),
    section(
      'Why this design',
      lesson.why.map((paragraph) => element('p', '', paragraph)),
    ),
    section('Takeaways', [list(lesson.takeaways)]),
  );
}
