import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Design } from '../src/design.ts';
import {
  computeLoad,
  describeUsers,
  requestsFrom,
  WORST_DAY,
} from '../src/load.ts';

/** Daily users whose average traffic is this many requests a second. */
const usersSending = (requests: number) => (requests * 86_400) / 50;

/** A small board: components by name, cables as "from>to" pairs. */
function board(
  nodes: Record<string, string>,
  cables: string[],
  users = usersSending(10),
): { design: Design; id: (name: string) => string } {
  const design = new Design();
  const ids = new Map<string, string>();
  Object.entries(nodes).forEach(([name, kind], i) => {
    const node = design.addNode(kind, { x: i * 300, y: 0 });
    if (kind === 'client') node.users = users;
    ids.set(name, node.id);
  });
  const id = (name: string) => ids.get(name)!;
  for (const cable of cables) {
    const [from, to] = cable.split('>');
    design.connect(
      { nodeId: id(from), side: 'right' },
      { nodeId: id(to), side: 'left' },
    );
  }
  return { design, id };
}

const requests = (design: Design, id: string) =>
  computeLoad(design).nodes.get(id)?.requests;

test('light traffic makes a light load on one server', () => {
  const { design, id } = board({ users: 'client', app: 'app-server' }, [
    'users>app',
  ]);
  const report = computeLoad(design);
  assert.equal(report.nodes.get(id('app'))?.requests, 10);
  assert.equal(report.health.get(id('users')), 'fast');
});

test('more traffic than a server can take overwhelms it', () => {
  const { design, id } = board(
    { users: 'client', app: 'app-server' },
    ['users>app'],
    usersSending(1_000),
  );
  const report = computeLoad(design);
  assert.ok(report.nodes.get(id('app'))!.ratio > 1);
  assert.equal(report.health.get(id('users')), 'failing');
});

test('a load balancer shares the traffic between its servers', () => {
  const { design, id } = board(
    { users: 'client', lb: 'load-balancer', a: 'app-server', b: 'app-server' },
    ['users>lb', 'lb>a', 'lb>b'],
    usersSending(1_000),
  );
  assert.equal(requests(design, id('a')), 500);
  assert.equal(requests(design, id('b')), 500);
});

test('users get slow before they get errors', () => {
  const { design, id } = board(
    { users: 'client', lb: 'load-balancer', a: 'app-server', b: 'app-server' },
    ['users>lb', 'lb>a', 'lb>b'],
    // 650 requests a second each: nearly full, not over.
    usersSending(1_300),
  );
  assert.equal(computeLoad(design).health.get(id('users')), 'slow');
});

test('a cache in front of the database takes most of its reads', () => {
  const { design, id } = board(
    { users: 'client', app: 'app-server', cache: 'cache', db: 'sql-database' },
    ['users>app', 'app>cache', 'app>db'],
    usersSending(1_000),
  );
  // 80% reads, 90% of those answered by the cache: 28% still reach it.
  assert.ok(Math.abs(requests(design, id('db'))! - 280) < 1e-9);
});

test('writes go to the primary and reads to its replica', () => {
  const { design, id } = board(
    {
      users: 'client',
      app: 'app-server',
      primary: 'sql-database',
      replica: 'sql-database',
    },
    ['users>app', 'app>primary', 'app>replica', 'primary>replica'],
    usersSending(1_000),
  );
  // 20% writes reach the primary; the replica answers the 80% reads and
  // applies every write the primary copies to it.
  assert.ok(Math.abs(requests(design, id('primary'))! - 200) < 1e-9);
  assert.ok(Math.abs(requests(design, id('replica'))! - 1000) < 1e-9);
});

test('replicas share the reads but each applies every write', () => {
  const { design, id } = board(
    {
      users: 'client',
      app: 'app-server',
      primary: 'sql-database',
      a: 'sql-database',
      b: 'sql-database',
    },
    ['users>app', 'app>primary', 'app>a', 'app>b', 'primary>a', 'primary>b'],
    usersSending(1_000),
  );
  assert.ok(Math.abs(requests(design, id('a'))! - 600) < 1e-9);
  assert.ok(Math.abs(requests(design, id('b'))! - 600) < 1e-9);
});

test('a cache in front of replicas takes most of their reads', () => {
  const { design, id } = board(
    {
      users: 'client',
      app: 'app-server',
      cache: 'cache',
      primary: 'sql-database',
      replica: 'sql-database',
    },
    ['users>app', 'app>cache', 'app>primary', 'app>replica', 'primary>replica'],
    usersSending(1_000),
  );
  assert.ok(Math.abs(requests(design, id('primary'))! - 200) < 1e-9);
  // 80 reads missing the cache, plus the 200 writes copied over.
  assert.ok(Math.abs(requests(design, id('replica'))! - 280) < 1e-9);
});

test('a CDN answers most requests itself', () => {
  const { design, id } = board(
    { users: 'client', cdn: 'cdn', files: 'object-storage' },
    ['users>cdn', 'cdn>files'],
    usersSending(1_000),
  );
  assert.ok(Math.abs(requests(design, id('files'))! - 50) < 1e-9);
});

test('traffic that loops back is not counted twice', () => {
  const { design, id } = board(
    {
      users: 'client',
      ws: 'websocket-gateway',
      chat: 'app-server',
      bus: 'pub-sub',
    },
    ['users>ws', 'ws>chat', 'chat>bus', 'bus>ws'],
  );
  assert.equal(requests(design, id('ws')), 10);
  // The chat service publishes what users send (their writes) once.
  assert.ok(Math.abs(requests(design, id('bus'))! - 2) < 1e-9);
});

test('traffic arriving back at a client goes no further', () => {
  const { design, id } = board(
    { users: 'client', app: 'app-server', email: 'external-service' },
    ['users>app', 'app>email', 'email>users'],
  );
  const report = computeLoad(design);
  assert.equal(report.nodes.has(id('users')), false);
  assert.equal(report.nodes.get(id('email'))?.requests, 10);
});

test('a client connected to nothing has no health state', () => {
  const { design, id } = board({ users: 'client' }, []);
  assert.equal(computeLoad(design).health.has(id('users')), false);
});

test('a million daily users send about 580 requests a second', () => {
  const client = new Design().addNode('client', { x: 0, y: 0 });
  client.users = 1_000_000;
  assert.equal(Math.round(requestsFrom(client)), 579);
  assert.equal(Math.round(requestsFrom(client, WORST_DAY)), 1736);
});

test('user counts read the way people say them', () => {
  assert.equal(describeUsers(10), '10 users');
  assert.equal(describeUsers(100_000), '100,000 users');
  assert.equal(describeUsers(1_000_000), '1 million users');
  assert.equal(describeUsers(10_000_000), '10 million users');
});

test('a copy wired like the original takes half its traffic', () => {
  const { design, id } = board(
    { users: 'client', app: 'app-server' },
    ['users>app'],
    usersSending(1_000),
  );
  const copy = design.copyWithConnections(id('app'));
  const report = computeLoad(design);
  assert.equal(report.nodes.get(id('app'))?.requests, 500);
  assert.equal(report.nodes.get(copy.id)?.requests, 500);
});

test('only what users do, not what they read, becomes background work', () => {
  const { design, id } = board(
    { users: 'client', app: 'app-server', queue: 'queue', worker: 'worker' },
    ['users>app', 'app>queue', 'queue>worker'],
    usersSending(1_000),
  );
  assert.ok(Math.abs(requests(design, id('queue'))! - 200) < 1e-9);
  assert.ok(Math.abs(requests(design, id('worker'))! - 200) < 1e-9);
});

test('a worker falling behind delays users, without giving them errors', () => {
  const apps = ['a', 'b', 'c', 'd'];
  const { design, id } = board(
    {
      users: 'client',
      lb: 'load-balancer',
      ...Object.fromEntries(apps.map((app) => [app, 'app-server'])),
      queue: 'queue',
      worker: 'worker',
    },
    [
      'users>lb',
      ...apps.flatMap((app) => [`lb>${app}`, `${app}>queue`]),
      'queue>worker',
    ],
    // 500 requests a second per server (fine), 400 tasks for one worker.
    usersSending(2_000),
  );
  const report = computeLoad(design);
  assert.ok(report.nodes.get(id('worker'))!.ratio > 1);
  assert.equal(report.health.get(id('users')), 'delayed');
  assert.equal(report.weakestLink.get(id('users')), id('worker'));
});

test('a struggling server still counts before a lagging worker', () => {
  const { design, id } = board(
    { users: 'client', app: 'app-server', queue: 'queue', worker: 'worker' },
    ['users>app', 'app>queue', 'queue>worker'],
    usersSending(10_000),
  );
  const report = computeLoad(design);
  assert.equal(report.health.get(id('users')), 'failing');
  assert.equal(report.weakestLink.get(id('users')), id('app'));
});

test('a client knows which component is its weakest link', () => {
  const { design, id } = board(
    {
      users: 'client',
      lb: 'load-balancer',
      app: 'app-server',
      db: 'sql-database',
    },
    ['users>lb', 'lb>app', 'app>db'],
    usersSending(1_000),
  );
  assert.equal(computeLoad(design).weakestLink.get(id('users')), id('app'));
});

test('on the worst day servers get 3× the traffic and databases 12×', () => {
  const { design, id } = board(
    { users: 'client', app: 'app-server', db: 'sql-database' },
    ['users>app', 'app>db'],
  );
  const report = computeLoad(design, WORST_DAY);
  assert.equal(report.nodes.get(id('app'))?.requests, 30);
  assert.equal(report.nodes.get(id('db'))?.requests, 120);
});

test('a cache also relieves the shards behind a shard router', () => {
  const { design, id } = board(
    {
      users: 'client',
      app: 'app-server',
      cache: 'cache',
      router: 'shard-router',
      a: 'sql-database',
      b: 'sql-database',
    },
    ['users>app', 'app>cache', 'app>router', 'router>a', 'router>b'],
    usersSending(1_000),
  );
  // 28% of 1,000 reach the router, shared between two shards.
  assert.ok(Math.abs(requests(design, id('a'))! - 140) < 1e-9);
});

test('queries are multiplied once, where they enter the database path', () => {
  const { design, id } = board(
    {
      users: 'client',
      app: 'app-server',
      router: 'shard-router',
      a: 'sql-database',
      b: 'sql-database',
    },
    ['users>app', 'app>router', 'router>a', 'router>b'],
  );
  const report = computeLoad(design, WORST_DAY);
  assert.equal(report.nodes.get(id('router'))?.requests, 120);
  assert.equal(report.nodes.get(id('a'))?.requests, 60);
});
