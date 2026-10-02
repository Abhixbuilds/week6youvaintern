const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const config = require('../config');
const { ApiError } = require('../middleware/errors');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { seedUser } = require('../seed');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
}).strict();

const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(72) }).strict();

const sign = userId => jwt.sign({ sub: userId }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });

module.exports = db => {
  const r = express.Router();

  r.post('/register', validate(registerSchema), (req, res) => {
    const { name, email: mail, password } = req.valid.body;
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) {
      throw new ApiError(409, 'An account with this email already exists');
    }
    const hash = bcrypt.hashSync(password, config.bcryptRounds);
    const id = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, mail, hash).lastInsertRowid;
    seedUser(db, id);
    res.status(201).json({ user: { id, name, email: mail }, token: sign(id) });
  });

  r.post('/login', validate(loginSchema), (req, res) => {
    const { email: mail, password } = req.valid.body;
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(mail);
    // same message for unknown email and wrong password: don't reveal which accounts exist
    if (!row || !bcrypt.compareSync(password, row.password_hash)) throw new ApiError(401, 'Invalid email or password');
    res.json({ user: { id: row.id, name: row.name, email: row.email }, token: sign(row.id) });
  });

  r.get('/me', requireAuth(db), (req, res) => res.json({ user: req.user }));

  return r;
};
