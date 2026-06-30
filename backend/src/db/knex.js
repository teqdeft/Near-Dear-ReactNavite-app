const knexLib = require('knex');
const config = require('../config');
const knexConfig = require('../../knexfile');

// Single shared Knex instance for the whole app.
const db = knexLib(knexConfig[config.env] || knexConfig.development);

module.exports = db;
