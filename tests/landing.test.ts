import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const landing = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const linkedBoards = [...landing.matchAll(/href="app\/#([\w-]+)"/g)].map(
  ([, id]) => id,
);

const boardFolders = [
  '../src/content/templates/',
  '../src/content/templates/foundations/',
];
const boardIds = boardFolders.flatMap((folder) => {
  const url = new URL(folder, import.meta.url);
  return readdirSync(url)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(new URL(file, url), 'utf8')).id);
});

test('every board the landing page links to exists', () => {
  const missing = linkedBoards.filter((id) => !boardIds.includes(id));
  assert.deepEqual(missing, []);
});

test('every board is listed on the landing page', () => {
  const unlisted = boardIds.filter((id) => !linkedBoards.includes(id));
  assert.deepEqual(unlisted, []);
});
