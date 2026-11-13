const { setTimeout: delay } = require('node:timers/promises');

module.exports = async function destroyAfterEvents(app) {
  // In pinned Strapi, document events start in fire-and-forget onCommit
  // callbacks. Closing Knex immediately after publish aborts their queries.
  const pool = app.db?.connection?.client?.pool;
  if (pool) {
    const deadline = Date.now() + 30_000;
    let idleSince = 0;
    while (Date.now() < deadline) {
      await delay(25);
      const busy = pool.numUsed() + pool.numPendingAcquires() + pool.numPendingCreates();
      if (busy) idleSince = 0;
      else if (!idleSince) idleSince = Date.now();
      else if (Date.now() - idleSince >= 100) break;
    }
  }
  await app.destroy();
};
