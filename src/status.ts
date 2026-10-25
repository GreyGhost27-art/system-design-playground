import { findKind } from './components.ts';
import type { DesignNode } from './design.ts';
import { fixesFor } from './fixes.ts';
import {
  AVERAGE_DAY,
  BUSY_AT,
  describeUsers,
  formatRequests,
  requestsFrom,
  usersOf,
  type Health,
  type NodeLoad,
  type Scenario,
} from './load.ts';

export type Tone = 'fine' | 'busy' | 'over' | 'idle';

/**
 * Three short lines about a selected component, each answering one
 * question: how bad is it, what's going on, and so what (with a tip).
 */
export interface Status {
  tone: Tone;
  /** The state in one word, shown in its colour. */
  label: string;
  /** How full it is, beside the label: "143% of what it can handle". */
  measure: string;
  /** What's arriving, against what it can take. */
  figures: string;
  /** What that means, and what to try when it's struggling. */
  detail: string;
}

export function describeStatus(
  node: DesignNode,
  load: NodeLoad | undefined,
  health: Health | undefined,
  weakestName: string | undefined,
  scenario: Scenario = AVERAGE_DAY,
): Status {
  if (node.kind === 'client') {
    return clientStatus(node, health, weakestName, scenario);
  }
  if (!load) {
    return {
      tone: 'idle',
      label: 'No traffic',
      measure: '',
      figures: 'Nothing sends it requests yet.',
      detail: '',
    };
  }

  const capacity = findKind(node.kind).capacity ?? Infinity;
  const measure = `${Math.round(load.ratio * 100)}% of what it can handle`;
  const figures =
    `Receiving ${formatRequests(load.requests)} requests a second; ` +
    `it can handle about ${formatRequests(capacity)}.`;
  const tip = tipFor(node.kind);

  if (load.ratio > 1) {
    const excess = formatRequests(load.requests - capacity);
    return {
      tone: 'over',
      label: 'Too busy',
      measure,
      figures,
      detail: `About ${excess} a second more than it can take, so some requests fail. ${tip}`,
    };
  }
  if (load.ratio >= BUSY_AT) {
    return {
      tone: 'busy',
      label: 'Busy',
      measure,
      figures,
      detail: `Nearly full, so answers slow down. ${tip}`,
    };
  }
  const room = Math.floor(1 / load.ratio);
  return {
    tone: 'fine',
    label: 'Fine',
    measure,
    figures,
    detail:
      room >= 100 ? 'Lots of room to spare.' : `Room for about ${room}× more.`,
  };
}

function clientStatus(
  client: DesignNode,
  health: Health | undefined,
  weakestName: string | undefined,
  scenario: Scenario,
): Status {
  if (!health) {
    return {
      tone: 'idle',
      label: 'Not connected',
      measure: '',
      figures: 'Connect it to something to send its traffic.',
      detail: '',
    };
  }
  const figures =
    `${describeUsers(usersOf(client))} a day, sending ` +
    `${formatRequests(requestsFrom(client, scenario))} requests a second.`;
  if (health === 'failing') {
    return {
      tone: 'over',
      label: 'Errors',
      measure: 'some users get errors',
      figures,
      detail: `The ${weakestName} is too busy. Tip: open Fix.`,
    };
  }
  if (health === 'delayed') {
    return {
      tone: 'busy',
      label: 'Delayed',
      measure: 'background work falls behind',
      figures,
      detail: `Answers are fast, but the ${weakestName} can't keep up, so results arrive late. Tip: open Fix.`,
    };
  }
  if (health === 'slow') {
    return {
      tone: 'busy',
      label: 'Slow',
      measure: 'answers take longer',
      figures,
      detail: `The ${weakestName} is busy. Tip: open Fix.`,
    };
  }
  return {
    tone: 'fine',
    label: 'Fast',
    measure: 'quick answers',
    figures,
    detail: 'Everything they use has room to spare.',
  };
}

/** The component's best fix, said as a tip that matches the Fix card. */
function tipFor(kind: string): string {
  const [best] = fixesFor(kind);
  if (!best) return '';
  const action = best.title[0].toLowerCase() + best.title.slice(1);
  return `Tip: ${action} (see Fix).`;
}
