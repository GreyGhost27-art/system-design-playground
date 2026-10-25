export function element(tag: string, className = '', text = ''): HTMLElement {
  const created = document.createElement(tag);
  if (className) created.className = className;
  if (text) created.textContent = text;
  return created;
}

export function section(title: string, content: HTMLElement[]): HTMLElement {
  const wrapper = element('section', 'drawer-section');
  wrapper.append(element('h3', '', title), ...content);
  return wrapper;
}

export function list(items: string[], className = ''): HTMLElement {
  const wrapper = element('ul', className);
  wrapper.append(...items.map((item) => element('li', '', item)));
  return wrapper;
}
