const app = require('./app');
const config = require('./config');
const db = require('./db/knex');

async function start() {
  try {
    // Verify DB connectivity before accepting traffic.
    await db.raw('select 1+1 as result');
    // eslint-disable-next-line no-console
    console.log('✅ Database connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Could not connect to the database. Check your .env DB_* values.');
    // eslint-disable-next-line no-console
    console.error(err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 NearDear API running at ${config.appUrl} (port ${config.port}, ${config.env})`);
  });
}

start();
