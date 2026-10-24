import { findKind } from './components.ts';
import type { Design, DesignNode } from './design.ts';

/** The user counts a client can be set to, with what each feels like. */
export const USER_LEVELS = [
  { users: 10, story: 'a side project' },
  { users: 1_000, story: 'a local business' },
  { users: 100_000, story: 'a popular app' },
  // Where splitting the data starts to be needed even on an average day.
  { users: 1_000_000, story: 'a big app' },
  { users: 10_000_000, story: 'a giant' },
] as const;

/** Clients that were never set behave like a local business. */
export const DEFAULT_USERS = 1_000;

// Each user sends a request about every 100 seconds.
const REQUESTS_PER_USER = 0.01;

/** The day being simulated: how hard traffic hits, and the database. */
export interface Scenario {
  /** Traffic compared with an average moment. */
  peak: number;
  /** Database queries each request makes. */
  queriesPerRequest: number;
}

export const AVERAGE_DAY: Scenario = { peak: 1, queriesPerRequest: 1 };
/**
 * The worst day: a rush (a TV ad, Black Friday) brings 3× the traffic, and
 * real pages make several queries each (or one per item in a list), so the
 * database takes 12× its average load while app servers take 3×.
 */
export const WORST_DAY: Scenario = { peak: 3, queriesPerRequest: 4 };
// Most traffic in most apps is reading, not writing.
const READ_SHARE = 0.8;
// Share of reads a cache, or requests a CDN, answers by itself.
const CACHE_HIT_RATE = 0.9;
const CDN_HIT_RATE = 0.95;
// Load at which a component counts as busy (slower) rather than fine.
export const BUSY_AT = 0.75;

// These send each request to one of the things behind them.
const SPLITTERS = new Set([
  'load-balancer',
  'api-gateway',
  'shard-router',
  'dns',
  'queue',
]);
const DATABASES = new Set(['sql-database', 'nosql-database', 'search-index']);
// Where queries go: the databases, and the router in front of their shards.
const DATA_PATH = new Set([...DATABASES, 'shard-router']);
// Work is handed off when users do something, not when they only look.
const MESSAGING = new Set(['queue', 'pub-sub', 'stream']);

/** How a client's users are doing: answered fast, slowly, or with errors. */
export type Health = 'fast' | 'slow' | 'failing';

export interface NodeLoad {
  /** Requests a second arriving. */
  requests: number;
  /** Share of its capacity in use: 1 means exactly full. */
  ratio: number;
}

export interface LoadReport {
  /** Every component that receives traffic, by node id. */
  nodes: Map<string, NodeLoad>;
  /** How each client's users are doing, by node id. */
  health: Map<string, Health>;
  /** The busiest component each client's traffic reaches: its weakest link. */
  weakestLink: Map<string, string>;
}

export function usersOf(node: DesignNode): number {
  return node.users ?? DEFAULT_USERS;
}

/** Requests a second a client sends: what its users add up to. */
export function requestsFrom(
  client: DesignNode,
  scenario: Scenario = AVERAGE_DAY,
): number {
  return usersOf(client) * REQUESTS_PER_USER * scenario.peak;
}

/** "1,000", "650", "less than 1": round, readable request counts. */
export function formatRequests(requests: number): string {
  if (requests < 1) return 'less than 1';
  return Number(requests.toPrecision(2)).toLocaleString('en-US');
}

/** "1,000 users", "10 million users": how a client's size reads. */
export function describeUsers(users: number): string {
  if (users >= 1_000_000) return `${users / 1_000_000} million users`;
  return `${users.toLocaleString('en-US')} ${users === 1 ? 'user' : 'users'}`;
}

/**
 * Follows every client's traffic along the cables (from → to) and works out
 * how busy each component gets. Deliberately simple, so it can be explained:
 * splitters share requests out, everything else passes each request on to
 * each thing it uses, caches and CDNs answer most of it themselves, and
 * loops are ignored so nothing is counted twice.
 */
export function computeLoad(
  design: Design,
  scenario: Scenario = AVERAGE_DAY,
): LoadReport {
  const isClient = (id: string) => design.getNode(id).kind === 'client';
  const callees = new Map<string, string[]>();
  for (const { from, to } of design.cables) {
    // Clients only send; traffic arriving at one (a reply, an alert) ends.
    if (isClient(to.nodeId)) continue;
    const list = callees.get(from.nodeId) ?? [];
    list.push(to.nodeId);
    callees.set(from.nodeId, list);
  }

  const clients = design.nodes.filter((node) => node.kind === 'client');
  const { order, loops } = forwardOrder(clients, callees);
  const forward = (from: string) =>
    (callees.get(from) ?? []).filter((to) => !loops.has(`${from}>${to}`));

  const arriving = new Map<string, number>();
  for (const id of order) {
    const node = design.getNode(id);
    const sent =
      node.kind === 'client'
        ? requestsFrom(node, scenario)
        : passedOn(node.kind, arriving.get(id) ?? 0);
    const targets = forward(id);
    for (const [to, requests] of share(design, node, sent, targets, scenario)) {
      arriving.set(to, (arriving.get(to) ?? 0) + requests);
    }
  }

  const nodes = new Map<string, NodeLoad>();
  for (const [id, requests] of arriving) {
    const capacity = findKind(design.getNode(id).kind).capacity ?? Infinity;
    nodes.set(id, { requests, ratio: requests / capacity });
  }

  const health = new Map<string, Health>();
  const weakestLink = new Map<string, string>();
  for (const client of clients) {
    const ratioOf = (id: string) => nodes.get(id)?.ratio ?? 0;
    const reached = [...reachable(client.id, forward)];
    if (reached.length === 0) continue;
    const weakest = reached.reduce((a, b) => (ratioOf(b) > ratioOf(a) ? b : a));
    const worst = ratioOf(weakest);
    health.set(
      client.id,
      worst > 1 ? 'failing' : worst >= BUSY_AT ? 'slow' : 'fast',
    );
    weakestLink.set(client.id, weakest);
  }
  return { nodes, health, weakestLink };
}

/** What a component sends on, given what arrives. */
function passedOn(kind: string, arriving: number): number {
  if (kind === 'cache') return arriving * (1 - READ_SHARE * CACHE_HIT_RATE);
  if (kind === 'cdn') return arriving * (1 - CDN_HIT_RATE);
  return arriving;
}

/** How a component's outgoing requests are shared among what it calls. */
function share(
  design: Design,
  node: DesignNode,
  sent: number,
  targets: string[],
  scenario: Scenario,
): Map<string, number> {
  const result = new Map<string, number>();
  if (targets.length === 0) return result;
  if (SPLITTERS.has(node.kind)) {
    for (const to of targets) result.set(to, sent / targets.length);
    return result;
  }

  const kindOf = (id: string) => design.getNode(id).kind;
  const usesCache = targets.some((to) => kindOf(to) === 'cache');
  // Several of the same kind (a primary and its replica, say) share the work.
  const sameKind = (kind: string) =>
    targets.filter((to) => kindOf(to) === kind).length;
  for (const to of targets) {
    const kind = kindOf(to);
    let requests = sent / sameKind(kind);
    if (DATABASES.has(node.kind)) {
      // A database passes on only its changes (to a replica, a relay…).
      requests *= 1 - READ_SHARE;
    } else if (MESSAGING.has(kind) && !MESSAGING.has(node.kind)) {
      requests *= 1 - READ_SHARE;
    } else if (DATA_PATH.has(kind) && !DATA_PATH.has(node.kind)) {
      // Entering the database path: each request makes its queries here,
      // once, and a cache in front answers most reads before they arrive.
      requests *= scenario.queriesPerRequest;
      if (usesCache) requests *= 1 - READ_SHARE * CACHE_HIT_RATE;
    }
    result.set(to, requests);
  }
  return result;
}

/**
 * Every component reachable from a client, ordered so that each comes after
 * everything that sends to it. Cables that lead back into a component
 * already on the current path are loops; they are returned separately.
 */
function forwardOrder(
  clients: DesignNode[],
  callees: Map<string, string[]>,
): { order: string[]; loops: Set<string> } {
  const finished: string[] = [];
  const loops = new Set<string>();
  const visited = new Set<string>();
  const onPath = new Set<string>();

  function visit(id: string): void {
    visited.add(id);
    onPath.add(id);
    for (const to of callees.get(id) ?? []) {
      if (onPath.has(to)) loops.add(`${id}>${to}`);
      else if (!visited.has(to)) visit(to);
    }
    onPath.delete(id);
    finished.push(id);
  }

  for (const client of clients) if (!visited.has(client.id)) visit(client.id);
  return { order: finished.reverse(), loops };
}

function reachable(
  start: string,
  forward: (from: string) => string[],
): Set<string> {
  const seen = new Set<string>();
  const stack = [...forward(start)];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...forward(id));
  }
  return seen;
}
