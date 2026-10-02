const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/errors');
const { requireAuth } = require('./middleware/auth');
const { requestLogger, logError } = require('./logger');

function createApp(db, {
  rateLimiting = true,
  clientDir = null,
  logRequests = config.logRequests,
  trustProxy = config.trustProxy,
  corsOrigin = config.corsOrigin,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', trustProxy); // behind Render/Heroku/etc. the real client IP is in X-Forwarded-For
  if (logRequests) app.use(requestLogger);
  app.use(helmet({
    contentSecurityPolicy: {
      // "upgrade-insecure-requests" breaks plain-http localhost in some browsers, so it is switched off
      directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'upgrade-insecure-requests': null },
    },
  }));
  if (corsOrigin) app.use(cors({ origin: corsOrigin })); // same-origin deployment needs no CORS
  app.use(express.json({ limit: '10kb' }));

  // health check for the hosting platform and uptime monitors: also proves the database answers
  app.get('/api/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
    } catch (err) {
      logError(err, req);
      res.status(503).json({ status: 'error' });
    }
  });

  if (rateLimiting) {
    app.use('/api/auth', rateLimit({
      windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
      message: { error: { message: 'Too many attempts, try again later' } },
    }));
  }
  app.use('/api/auth', require('./routes/auth')(db));

  const auth = requireAuth(db);
  const problems = require('./routes/problems')(db);
  app.use('/api/topics/:topicId/problems', auth, problems.nested);
  app.use('/api/topics', auth, require('./routes/topics')(db));
  app.use('/api/problems', auth, problems.flat);
  app.use('/api/stats', auth, require('./routes/stats')(db));

  if (clientDir) app.use(express.static(clientDir)); // serve the front end from the same origin

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
