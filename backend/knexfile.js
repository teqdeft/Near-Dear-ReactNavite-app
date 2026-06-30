const config = require('./src/config');

/**
 * Knex configuration for NearDear (MySQL).
 * Migrations and seeds live under src/db.
 */
const base = {
  client: 'mysql2',
  connection: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    // Return DATE/DATETIME as plain strings (avoids JS timezone surprises).
    dateStrings: true,
    timezone: '+00:00',
    charset: 'utf8mb4',
  },
  pool: { min: config.db.poolMin, max: config.db.poolMax },
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};

module.exports = {
  development: base,
  production: base,
};
