/* Structured (JSON-per-line) logging. Hosting platforms collect stdout/stderr, so no log files are needed.
   Never log passwords, tokens, request bodies or the Authorization header. */
const log = (level, fields) => {
  const line = JSON.stringify({ time: new Date().toISOString(), level, ...fields });
  (level === 'error' ? console.error : console.log)(line);
};

const logError = (err, req) => log('error', {
  method: req && req.method,
  path: req && req.originalUrl && req.originalUrl.split('?')[0], // query strings are left out on purpose
  message: err && err.message,
  stack: err && err.stack,
});

// one line per finished request: method, path, status and duration
function requestLogger(req, res, next) {
  if (req.path === '/api/health') return next(); // platform health checks would flood the log
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    log('info', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10,
      ip: req.ip,
    });
  });
  next();
}

module.exports = { log, logError, requestLogger };
