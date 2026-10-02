const jwt = require('jsonwebtoken');
const config = require('../config');
const { ApiError } = require('./errors');

const requireAuth = db => (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Missing or malformed Authorization header');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(payload.sub);
  if (!user) throw new ApiError(401, 'Invalid or expired token');
  req.user = user;
  next();
};

module.exports = { requireAuth };
