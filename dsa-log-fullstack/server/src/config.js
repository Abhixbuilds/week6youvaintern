const path = require('path');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) throw new Error('JWT_SECRET must be set in production');
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');
}

const flag = (value, fallback) => (value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase()));

// "trust proxy": how many reverse proxies sit in front of the app (1 on Render/Heroku/Railway).
// Needed so req.ip, and therefore the rate limiter, sees the real visitor instead of the proxy.
function parseTrustProxy(value) {
  if (value === undefined || value === '') return isProd ? 1 : false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value; // e.g. "loopback"
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  dbPath: process.env.DB_PATH || './data/dsa-log.db',
  // The front end is served by the same server (same origin), so production needs no CORS at all.
  // Leave CORS_ORIGIN unset in production; set it only if a separate front-end domain must call the API.
  corsOrigin: process.env.CORS_ORIGIN === undefined ? (isProd ? '' : '*') : process.env.CORS_ORIGIN,
  clientDir: process.env.CLIENT_DIR || path.resolve(__dirname, '../../client'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  logRequests: flag(process.env.LOG_REQUESTS, isProd), // one JSON line per request (skips /api/health)
};
