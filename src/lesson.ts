import type { Template } from './templates.ts';

export function renderLesson(
  container: HTMLElement,
  template: Template,
  position: { number: number; total: number },
): void {
  const { lesson } = template;
  container.replaceChildren(
    element('p', 'eyebrow', `Template ${position.number} of ${position.total}`),
    element('h2', 'lesson-title', template.title),
    element('p', 'lesson-summary', template.summary),
    section('The problem', [element('p', '', lesson.problem)]),
    section(
      'Why this design',
      lesson.why.map((paragraph) => element('p', '', paragraph)),
    ),
    section('Takeaways', [list(lesson.takeaways)]),
  );
}

function section(title: string, content: HTMLElement[]): HTMLElement {
  const wrapper = element('section', 'lesson-section');
  wrapper.append(element('h3', '', title), ...content);
  return wrapper;
}

function list(items: string[]): HTMLElement {
  const wrapper = element('ul');
  wrapper.append(...items.map((item) => element('li', '', item)));
  return wrapper;
}

function element(tag: string, className = '', text = ''): HTMLElement {
  const created = document.createElement(tag);
  if (className) created.className = className;
  if (text) created.textContent = text;
  return created;
}
