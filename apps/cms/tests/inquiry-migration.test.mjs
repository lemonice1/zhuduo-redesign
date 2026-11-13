import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const database = path.dirname(require.resolve('@strapi/database'));
const { discoverMigrationFiles } = require(path.join(database, 'migrations/discover.js'));
const { resolveMigrationFiles } = require(path.join(database, 'migrations/resolver.js'));
const { createMigrationRunner } = require(path.join(database, 'migrations/runner.js'));
const knex = require('knex')({ client: 'pg' });
const dir = fileURLToPath(new URL('../database/migrations', import.meta.url));

async function run({ exists = true, columns = ['status'], records = [{ status: 'quoted' }] } = {}) {
  const sql = [], executed = [];
  let transactions = 0;
  const files = discoverMigrationFiles(dir);
  assert.equal(files.some(file => path.basename(file) === '2026.10.10T00.00.00.inquiry-follow-up-status.js'), true, 'Inquiry migration is not discovered by the real Strapi runner');
  const trx = { schema: {
    hasTable: async table => { assert.equal(table, 'inquiries'); return exists; },
    hasColumn: async (table, column) => { assert.equal(table, 'inquiries'); return columns.includes(column); },
    alterTable: async (table, change) => {
      const query = knex.schema.alterTable(table, change).toSQL();
      sql.push(...query.map(statement => statement.sql));
      assert.deepEqual(sql, ['alter table "inquiries" rename "status" to "follow_up_status"']);
      columns.splice(columns.indexOf('status'), 1, 'follow_up_status');
      for (const row of records) { row.follow_up_status = row.status; delete row.status; }
    }
  } };
  const db = { transaction: async work => { transactions++; return work({ trx }); } };
  const runner = createMigrationRunner({ getMigrations: async () => resolveMigrationFiles(files, { db }), storage: { executed: async () => executed, logMigration: async ({ name }) => executed.push(name) }, logger: { info() {} } });
  await runner.up(); await runner.up();
  assert.equal(transactions, 1);
  return { sql, records, executed };
}

test('real Strapi migration discovery/resolver/runner applies a PostgreSQL column rename once preserving follow-up values', async () => {
  const result = await run({ records: [{ status: 'new' }, { status: 'qualified' }, { status: 'won' }] });
  assert.deepEqual(result.records, [{ follow_up_status: 'new' }, { follow_up_status: 'qualified' }, { follow_up_status: 'won' }]);
  assert.equal(result.executed.length, 1);
});

test('fresh and already migrated databases skip the rename and ambiguous dual columns fail closed', async () => {
  for (const fixture of [{ exists: false }, { columns: ['follow_up_status'] }, { columns: [] }]) assert.deepEqual((await run(fixture)).sql, []);
  await assert.rejects(run({ columns: ['status', 'follow_up_status'] }), /both.*columns/i);
});

test('Strapi three-way schema synchronization retains the renamed column when prior metadata still tracks status', async () => {
  const createDiff = require(path.join(database, 'schema/diff.js'));
  const column = name => ({ name, type: 'varchar', defaultTo: 'new', notNullable: false, unsigned: false });
  const schema = name => ({ tables: [{ name: 'inquiries', columns: [column(name)], indexes: [], foreignKeys: [] }] });
  const PostgresDialect = require(path.join(database, 'dialects/postgresql/index.js'));
  const diff = createDiff({ dialect: new PostgresDialect({}) });
  const result = await diff.diff({ previousSchema: schema('status'), databaseSchema: schema('follow_up_status'), userSchema: schema('follow_up_status') });
  assert.equal(result.status, 'UNCHANGED');
  assert.deepEqual(result.diff.tables.updated, []);
  assert.deepEqual(result.diff.tables.removed, []);
});
