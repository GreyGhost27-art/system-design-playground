import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DesignNode } from '../src/model/design.ts';
import { describeStatus } from '../src/simulation/status.ts';

const server: DesignNode = { id: 's', kind: 'app-server', x: 0, y: 0 };
const database: DesignNode = { id: 'd', kind: 'sql-database', x: 0, y: 0 };
const users: DesignNode = {
  id: 'u',
  kind: 'client',
  users: 100_000,
  x: 0,
  y: 0,
};

test('a calm component says what arrives, what it can take and the room left', () => {
  const status = describeStatus(
    server,
    { requests: 140, ratio: 0.2 },
    undefined,
    undefined,
  );
  assert.deepEqual(status, {
    tone: 'fine',
    label: 'Fine',
    measure: '20% of what it can handle',
    figures: 'Receiving 140 requests a second; it can handle about 700.',
    detail: 'Room for about 5× more.',
  });
});

test('a too-busy component says by how much it is over, and its best fix', () => {
  const status = describeStatus(
    server,
    { requests: 1000, ratio: 1000 / 700 },
    undefined,
    undefined,
  );
  assert.equal(status.label, 'Too busy');
  assert.equal(status.measure, '143% of what it can handle');
  assert.equal(
    status.detail,
    'About 300 a second more than it can take, so some requests fail. Tip: add a copy (see Fix).',
  );
});

test('a busy database is pointed at a cache, not a copy', () => {
  const status = describeStatus(
    database,
    { requests: 1700, ratio: 0.85 },
    undefined,
    undefined,
  );
  assert.equal(status.label, 'Busy');
  assert.match(status.detail, /Tip: put a cache in front of it/);
});

test('a component nothing reaches says so', () => {
  const status = describeStatus(server, undefined, undefined, undefined);
  assert.equal(status.label, 'No traffic');
  assert.equal(status.figures, 'Nothing sends it requests yet.');
});

test('a delayed client says its answers are fast but results are late', () => {
  const status = describeStatus(users, undefined, 'delayed', 'Email Worker');
  assert.equal(status.label, 'Delayed');
  assert.equal(status.tone, 'busy');
  assert.match(status.detail, /Email Worker can't keep up/);
});

test('a struggling client says how many users send what, and its weakest link', () => {
  const status = describeStatus(users, undefined, 'failing', 'Main DB');
  assert.equal(status.label, 'Errors');
  assert.equal(
    status.figures,
    '100,000 users a day, sending 58 requests a second.',
  );
  assert.equal(status.detail, 'The Main DB is too busy. Tip: open Fix.');
});
