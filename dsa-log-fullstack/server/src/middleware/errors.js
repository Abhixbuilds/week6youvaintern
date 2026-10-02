const { ZodError } = require('zod');
const { logError } = require('../logger');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const notFound = (req, res) =>
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const details = err.issues.map(i => ({ field: i.path.join('.') || 'body', message: i.message }));
    return res.status(400).json({ error: { message: 'Validation failed', details } });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, ...(err.details && { details: err.details }) } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request body too large' } });
  }
  logError(err, req); // details go to the server log only, never to the client
  res.status(500).json({ error: { message: 'Internal server error' } });
}

module.exports = { ApiError, notFound, errorHandler };
