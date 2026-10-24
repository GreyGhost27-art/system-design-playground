import { element, list, section } from './dom.ts';
import type { TemplateSection } from './templateLibrary.ts';
import type { Template } from './templates.ts';

export function renderLesson(
  container: HTMLElement,
  template: Template,
  { itemName, headings, templates }: TemplateSection,
): void {
  const { lesson } = template;
  const number = templates.indexOf(template) + 1;
  container.replaceChildren(
    element('p', 'eyebrow', `${itemName} ${number} of ${templates.length}`),
    element('h2', 'drawer-title', template.title),
    element('p', 'drawer-subtitle', template.summary),
    section(headings.problem, [element('p', '', lesson.problem)]),
    section(
      headings.why,
      lesson.why.map((paragraph) => element('p', '', paragraph)),
    ),
    section('Takeaways', [list(lesson.takeaways)]),
  );
}
