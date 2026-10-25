import { findKind } from '../content/components.ts';
import type { Design, DesignNode } from '../model/design.ts';

/**
 * The daily users a client can be set to (people who use it on a given day,
 * the number interviews start from), with what each feels like.
 */
export const USER_LEVELS = [
  { users: 10, story: 'a side project' },
  { users: 1_000, story: 'a local business' },
  { users: 100_000, story: 'a popular app' },
  // Where one server stops being enough, and the worst day hurts the database.
  { users: 1_000_000, story: 'a big app' },
  { users: 10_000_000, story: 'a giant' },
] as const;

/** Clients that were never set behave like a local business. */
export const DEFAULT_USERS = 1_000;

// A few visits a day, a few pages each, each page a few requests.
const REQUESTS_PER_USER_PER_DAY = 50;
const SECONDS_PER_DAY = 86_400;

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

/**
 * How a client's users are doing: answered fast, slowly, or with errors; or
 * answered fine while the work handed to the background falls behind.
 */
export type Health = 'fast' | 'slow' | 'failing' | 'delayed';

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
  /** The component holding each client's users back: its weakest link. */
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
  const perDay = usersOf(client) * REQUESTS_PER_USER_PER_DAY;
  return (perDay / SECONDS_PER_DAY) * scenario.peak;
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
  // Requests that are all writes: what a primary gets when reads go elsewhere.
  const arrivingWrites = new Map<string, number>();
  for (const id of order) {
    const node = design.getNode(id);
    const sent =
      node.kind === 'client'
        ? requestsFrom(node, scenario)
        : passedOn(
            node.kind,
            arriving.get(id) ?? 0,
            arrivingWrites.get(id) ?? 0,
          );
    const targets = forward(id);
    const shares = share(design, node, sent, targets, scenario);
    for (const [to, { requests, writesOnly }] of shares) {
      arriving.set(to, (arriving.get(to) ?? 0) + requests);
      if (writesOnly) {
        arrivingWrites.set(to, (arrivingWrites.get(to) ?? 0) + requests);
      }
    }
  }

  const nodes = new Map<string, NodeLoad>();
  for (const [id, requests] of arriving) {
    const capacity = findKind(design.getNode(id).kind).capacity ?? Infinity;
    nodes.set(id, { requests, ratio: requests / capacity });
  }

  const health = new Map<string, Health>();
  const weakestLink = new Map<string, string>();
  const ratioOf = (id: string) => nodes.get(id)?.ratio ?? 0;
  const busiest = (ids: string[]) =>
    ids.reduce((a, b) => (ratioOf(b) > ratioOf(a) ? b : a));
  for (const client of clients) {
    const reached = reachable(client.id, forward);
    if (reached.size === 0) continue;
    // Users wait for everything up to a queue, stream or pub/sub; what is
    // behind it happens later, so when it falls behind, results are late
    // but users still get their answers.
    const waitedOn = reachable(client.id, (id) =>
      MESSAGING.has(design.getNode(id).kind) ? [] : forward(id),
    );
    const background = [...reached].filter((id) => !waitedOn.has(id));
    const weakest = busiest([...waitedOn]);
    const worst = ratioOf(weakest);
    const lagging = background.length > 0 ? busiest(background) : weakest;
    if (worst < BUSY_AT && ratioOf(lagging) > 1) {
      health.set(client.id, 'delayed');
      weakestLink.set(client.id, lagging);
      continue;
    }
    health.set(
      client.id,
      worst > 1 ? 'failing' : worst >= BUSY_AT ? 'slow' : 'fast',
    );
    weakestLink.set(client.id, weakest);
  }
  return { nodes, health, weakestLink };
}

/** What a component sends on, given what arrives (and how much is writes). */
function passedOn(kind: string, arriving: number, writes: number): number {
  if (kind === 'cache') return arriving * (1 - READ_SHARE * CACHE_HIT_RATE);
  if (kind === 'cdn') return arriving * (1 - CDN_HIT_RATE);
  // A database passes on only its changes (to a replica, a relay…).
  if (DATABASES.has(kind))
    return (arriving - writes) * (1 - READ_SHARE) + writes;
  return arriving;
}

interface Share {
  requests: number;
  /** True when every request is a write, so all of it is a change. */
  writesOnly?: boolean;
}

/** How a component's outgoing requests are shared among what it calls. */
function share(
  design: Design,
  node: DesignNode,
  sent: number,
  targets: string[],
  scenario: Scenario,
): Map<string, Share> {
  const result = new Map<string, Share>();
  if (targets.length === 0) return result;
  if (SPLITTERS.has(node.kind)) {
    for (const to of targets) {
      result.set(to, { requests: sent / targets.length });
    }
    return result;
  }
  if (DATABASES.has(node.kind)) {
    // Every copy (or relay) needs every change, so none of it is shared.
    for (const to of targets) result.set(to, { requests: sent });
    return result;
  }

  const kindOf = (id: string) => design.getNode(id).kind;
  const usesCache = targets.some((to) => kindOf(to) === 'cache');
  const cacheMisses = usesCache ? 1 - CACHE_HIT_RATE : 1;
  const { primaries, replicas } = primariesAndReplicas(design, targets);
  // Several of the same kind (copies of a server, say) share the work.
  const sameKind = (kind: string) =>
    targets.filter((to) => kindOf(to) === kind).length;
  for (const to of targets) {
    const kind = kindOf(to);
    const queries = sent * scenario.queriesPerRequest;
    if (primaries.includes(to)) {
      // Writes go to the primary; its replicas answer the reads.
      const writes = (queries * (1 - READ_SHARE)) / primaries.length;
      result.set(to, { requests: writes, writesOnly: true });
      continue;
    }
    if (replicas.includes(to)) {
      const reads = queries * READ_SHARE * cacheMisses;
      result.set(to, { requests: reads / replicas.length });
      continue;
    }
    let requests = sent / sameKind(kind);
    if (MESSAGING.has(kind) && !MESSAGING.has(node.kind)) {
      requests *= 1 - READ_SHARE;
    } else if (DATA_PATH.has(kind) && !DATA_PATH.has(node.kind)) {
      // Entering the database path: each request makes its queries here,
      // once, and a cache in front answers most reads before they arrive.
      requests *= scenario.queriesPerRequest;
      if (usesCache) requests *= 1 - READ_SHARE * CACHE_HIT_RATE;
    }
    result.set(to, { requests });
  }
  return result;
}

/**
 * Among the databases a component uses, the replicas (copied to by another
 * of them) and the primaries that copy to them.
 */
function primariesAndReplicas(
  design: Design,
  targets: string[],
): { primaries: string[]; replicas: string[] } {
  const isDatabase = (id: string) => DATABASES.has(design.getNode(id).kind);
  const copiesTo = (from: string, to: string) =>
    design.cables.some(
      (cable) => cable.from.nodeId === from && cable.to.nodeId === to,
    );
  const databases = targets.filter(isDatabase);
  const replicas = databases.filter((replica) =>
    databases.some((primary) => copiesTo(primary, replica)),
  );
  const primaries = databases.filter((primary) =>
    replicas.some((replica) => copiesTo(primary, replica)),
  );
  return { primaries, replicas };
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
