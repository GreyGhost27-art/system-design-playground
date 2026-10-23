export type Category = 'edge' | 'routing' | 'compute' | 'data' | 'async';

export interface ComponentKind {
  id: string;
  label: string;
  badge: string;
  category: Category;
}

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'edge', label: 'Edge', color: '#5eb1ff' },
  { id: 'routing', label: 'Routing', color: '#b48cff' },
  { id: 'compute', label: 'Compute', color: '#4fd1a5' },
  { id: 'data', label: 'Data', color: '#ffb454' },
  { id: 'async', label: 'Async', color: '#ff7a90' },
];

function kind(
  category: Category,
  id: string,
  label: string,
  badge: string,
): ComponentKind {
  return { id, label, badge, category };
}

export const COMPONENT_KINDS: ComponentKind[] = [
  kind('edge', 'client', 'Client', 'CL'),
  kind('edge', 'dns', 'DNS', 'DNS'),
  kind('edge', 'cdn', 'CDN', 'CDN'),
  kind('routing', 'load-balancer', 'Load Balancer', 'LB'),
  kind('routing', 'api-gateway', 'API Gateway', 'GW'),
  kind('routing', 'rate-limiter', 'Rate Limiter', 'RL'),
  kind('compute', 'app-server', 'App Server', 'APP'),
  kind('compute', 'worker', 'Worker', 'WK'),
  kind('compute', 'function', 'Function', 'λ'),
  kind('data', 'sql-database', 'SQL Database', 'SQL'),
  kind('data', 'nosql-database', 'NoSQL Database', 'NO'),
  kind('data', 'cache', 'Cache', 'CA'),
  kind('data', 'object-storage', 'Object Storage', 'OBJ'),
  kind('data', 'search-index', 'Search Index', 'IDX'),
  kind('async', 'queue', 'Queue', 'Q'),
  kind('async', 'pub-sub', 'Pub/Sub', 'PS'),
  kind('async', 'stream', 'Stream', 'STR'),
];

export function findKind(id: string): ComponentKind {
  const match = COMPONENT_KINDS.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Unknown component kind: ${id}`);
  return match;
}

export function categoryColor(category: Category): string {
  return CATEGORIES.find((candidate) => candidate.id === category)!.color;
}
