import { findKind } from './components.ts';
import type { DesignNode } from './design.ts';
import { element, section } from './dom.ts';
import { fixesFor, type Fix } from './fixes.ts';
import {
  BUSY_AT,
  describeUsers,
  usersOf,
  type Health,
  type NodeLoad,
} from './load.ts';

export interface FixCardActions {
  addCopy(): void;
  /** "Foundation 4: How do we keep…", or null if the board is unknown. */
  boardName(id: string): string | null;
  /** Selects a component and opens its Fix card. */
  showMe(nodeId: string): void;
}

/** Why a component is busy, in its own numbers, and what to try. */
export function renderComponentFix(
  container: HTMLElement,
  node: DesignNode,
  load: NodeLoad | undefined,
  actions: FixCardActions,
): void {
  const kind = findKind(node.kind);
  const ratio = load?.ratio ?? 0;
  const capacity = kind.capacity ?? 0;
  const requests = load?.requests ?? 0;
  const verdict =
    ratio > 1
      ? `That's about ${formatRate(requests - capacity)} more than it can take, so some requests fail.`
      : ratio >= BUSY_AT
        ? "It's nearly full, so answers slow down."
        : 'It has room to spare now.';

  container.replaceChildren(
    statusEyebrow(ratio),
    element('h2', 'drawer-title', node.label ?? kind.label),
    element(
      'p',
      'drawer-lede',
      `It's receiving about ${formatRate(requests)}; one ${kind.label} can handle about ${formatRate(capacity)}. ${verdict}`,
    ),
    section('Try this', [fixList(fixesFor(node.kind), actions)]),
  );
}

/** How a client's users are doing, and which component holds them back. */
export function renderClientFix(
  container: HTMLElement,
  client: DesignNode,
  health: Health | undefined,
  weakest: DesignNode | undefined,
  weakestLoad: NodeLoad | undefined,
  actions: FixCardActions,
): void {
  const users = describeUsers(usersOf(client));
  const summary =
    health === 'failing'
      ? `Some of these ${users} get errors.`
      : health === 'slow'
        ? `These ${users} wait longer than they should.`
        : health === 'delayed'
          ? `These ${users} get fast answers, but what happens in the background (emails, updates) arrives late.`
          : `These ${users} get fast answers.`;
  const children: HTMLElement[] = [
    statusEyebrow(
      health === 'failing' ? 2 : health && health !== 'fast' ? BUSY_AT : 0,
    ),
    element('h2', 'drawer-title', client.label ?? 'Users'),
    element('p', 'drawer-lede', summary),
  ];

  if (weakest && health !== 'fast') {
    const name = weakest.label ?? findKind(weakest.kind).label;
    const state = (weakestLoad?.ratio ?? 0) > 1 ? 'too busy' : 'busy';
    const showMe = element('button', 'fix-action', `Show me the ${name}`);
    showMe.addEventListener('click', () => actions.showMe(weakest.id));
    children.push(
      section('What holds them back', [
        element('p', '', `The weakest link is the ${name}: it's ${state}.`),
        showMe,
      ]),
    );
  }
  container.replaceChildren(...children);
}

function statusEyebrow(ratio: number): HTMLElement {
  const [text, status] =
    ratio > 1
      ? ['Too busy', 'over']
      : ratio >= BUSY_AT
        ? ['Busy', 'busy']
        : ['Fine', 'fine'];
  return element('p', `eyebrow status-${status}`, text);
}

function fixList(fixes: Fix[], actions: FixCardActions): HTMLElement {
  const list = element('ol', 'fix-list');
  for (const fix of fixes) {
    const item = element('li');
    item.append(element('strong', '', fix.title), element('p', '', fix.why));
    if (fix.action === 'add-copy') {
      const button = element('button', 'fix-action', 'Add a copy');
      button.addEventListener('click', () => actions.addCopy());
      item.append(button);
    }
    const boardName = fix.board && actions.boardName(fix.board);
    if (fix.board && boardName) {
      // A new tab, so the board you're working on stays as it is.
      const link = element('a', 'fix-link', `Learn how: ${boardName} ↗`);
      link.setAttribute('href', `#${fix.board}`);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
      item.append(link);
    }
    list.append(item);
  }
  return list;
}

/** "about 1,000 requests a second", in round, readable numbers. */
function formatRate(requests: number): string {
  if (requests < 1) return 'less than 1 request a second';
  const rounded = Number(requests.toPrecision(2));
  const count = rounded.toLocaleString('en-US');
  return `${count} request${rounded === 1 ? '' : 's'} a second`;
}
