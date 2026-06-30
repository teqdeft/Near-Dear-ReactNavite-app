const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (config.env !== 'test') app.use(morgan('dev'));

// Health check.
app.get('/', (req, res) =>
  res.json({ success: true, message: 'NearDear API', version: '1.0.0', env: config.env })
);
app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// API routes.
app.use('/api/v1', routes);

// 404 + error handling.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
