const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const dbModulePath = require.resolve('../src/db');

function resetEnv() {
  delete process.env.DATABASE_URL;
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGDATABASE;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete require.cache[dbModulePath];
}

function loadDbWithStubbedPool() {
  const originalLoad = Module._load;
  const fakePool = function FakePool() {
    this.on = () => {};
    this.query = async (sql) => {
      if (sql.includes('SELECT COUNT(*) AS c FROM users') || sql.includes('SELECT COUNT(*) AS c FROM assignees')) {
        return { rows: [{ c: 0 }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 1 }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO assignees')) {
        return { rows: [{ id: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
  };

  Module._load = function patched(request, parent, isMain) {
    if (request === 'pg') {
      return { Pool: fakePool };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    delete require.cache[dbModulePath];
    return require('../src/db');
  } finally {
    Module._load = originalLoad;
  }
}

test('resolveDbConfig prefers DATABASE_URL when available', () => {
  resetEnv();
  process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/app';

  const db = loadDbWithStubbedPool();
  const cfg = db.resolveDbConfig();

  assert.equal(cfg.connectionString, 'postgresql://user:pass@host:5432/app');
  resetEnv();
});

test('resolveDbConfig falls back to PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD', () => {
  resetEnv();
  process.env.PGHOST = 'localhost';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'lms';
  process.env.PGUSER = 'postgres';
  process.env.PGPASSWORD = 'postgres';

  const db = loadDbWithStubbedPool();
  const cfg = db.resolveDbConfig();

  assert.deepEqual(cfg, {
    host: 'localhost',
    port: 5432,
    database: 'lms',
    user: 'postgres',
    password: 'postgres',
  });
  resetEnv();
});
