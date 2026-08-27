const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const dbModulePath = require.resolve('../src/db');

function resetDbEnv() {
  delete process.env.DB_PATH;
  delete process.env.RENDER;
  delete require.cache[dbModulePath];
}

test('resolveDbPath falls back to the Render persistent volume in production', () => {
  resetDbEnv();
  process.env.RENDER = 'true';

  const db = require('../src/db');

  assert.strictEqual(typeof db.resolveDbPath, 'function');
  assert.strictEqual(db.resolveDbPath(), '/var/data/lms.sqlite');

  resetDbEnv();
});

test('resolveDbPath respects the explicit DB_PATH override', () => {
  resetDbEnv();
  process.env.DB_PATH = './custom-data/lms.sqlite';

  const db = require('../src/db');

  assert.strictEqual(db.resolveDbPath(), path.resolve(__dirname, '..', './custom-data/lms.sqlite'));

  resetDbEnv();
});
