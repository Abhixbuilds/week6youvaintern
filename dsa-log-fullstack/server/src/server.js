const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createDb } = require('./db');
const { createApp } = require('./app');
const { log, logError } = require('./logger');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = createDb(config.dbPath);
const server = createApp(db, { clientDir: config.clientDir }).listen(config.port, () => {
  console.log(`DSA Log app running on http://localhost:${config.port}`);
  log('info', { event: 'startup', env: config.isProd ? 'production' : 'development', port: config.port, dbPath: config.dbPath, trustProxy: config.trustProxy });
});

// Platform load balancers keep idle connections open for about 60 s. Node's default (5 s) closes them first,
// which shows up as random 502 errors. Keep Node's timeouts longer than the proxy's.
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 66 * 1000;

function shutdown(signal) {
  log('info', { event: 'shutdown', signal });
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10 * 1000).unref(); // do not hang forever on open connections
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM')); // sent by the platform on every deploy / restart

// last-resort handlers: log the reason, then exit so the platform restarts a clean process
process.on('uncaughtException', err => { logError(err); process.exit(1); });
process.on('unhandledRejection', reason => { logError(reason instanceof Error ? reason : new Error(String(reason))); process.exit(1); });
