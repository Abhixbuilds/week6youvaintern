const express = require('express');
const { z } = require('zod');
const { ApiError } = require('../middleware/errors');
const { validate } = require('../middleware/validate');

const id = z.coerce.number().int().positive();
const level = z.enum(['Easy', 'Medium', 'Hard']);
const topicParam = z.object({ topicId: id });
const problemParam = z.object({ id });
const listQuery = z.object({
  level: level.optional(),
  solved: z.enum(['true', 'false']).optional(),
});
const createSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(150), level }).strict();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  level: level.optional(),
  solved: z.boolean().optional(),
}).strict().refine(o => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

const shape = p => ({ id: p.id, topicId: p.topic_id, name: p.name, level: p.level, solved: !!p.solved, createdAt: p.created_at });

/* Two routers: nested under /topics/:topicId/problems, and flat /problems/:id */
module.exports = db => {
  const nested = express.Router({ mergeParams: true });
  const flat = express.Router();

  const ownedTopic = (topicId, userId) => {
    const t = db.prepare('SELECT id FROM topics WHERE id = ? AND user_id = ?').get(topicId, userId);
    if (!t) throw new ApiError(404, 'Topic not found');
  };
  const ownedProblem = (pid, userId) => {
    const p = db.prepare(`SELECT p.* FROM problems p JOIN topics t ON t.id = p.topic_id WHERE p.id = ? AND t.user_id = ?`).get(pid, userId);
    if (!p) throw new ApiError(404, 'Problem not found');
    return p;
  };

  nested.get('/', validate(topicParam, 'params'), validate(listQuery, 'query'), (req, res) => {
    ownedTopic(req.valid.params.topicId, req.user.id);
    const { level: lv, solved } = req.valid.query;
    const filters = ['topic_id = ?'];
    const params = [req.valid.params.topicId];

    if (lv) {
      filters.push('level = ?');
      params.push(lv);
    }
    if (solved) {
      filters.push('solved = ?');
      params.push(solved === 'true' ? 1 : 0);
    }

    const rows = db.prepare(`SELECT * FROM problems WHERE ${filters.join(' AND ')} ORDER BY id`).all(...params);
    res.json({ count: rows.length, problems: rows.map(shape) });
  });

  nested.post('/', validate(topicParam, 'params'), validate(createSchema), (req, res) => {
    ownedTopic(req.valid.params.topicId, req.user.id);
    const { name, level: lv } = req.valid.body;
    const newId = db.prepare('INSERT INTO problems (topic_id, name, level) VALUES (?, ?, ?)').run(req.valid.params.topicId, name, lv).lastInsertRowid;
    res.status(201).json({ problem: shape(db.prepare('SELECT * FROM problems WHERE id = ?').get(newId)) });
  });

  flat.get('/:id', validate(problemParam, 'params'), (req, res) => {
    res.json({ problem: shape(ownedProblem(req.valid.params.id, req.user.id)) });
  });

  flat.patch('/:id', validate(problemParam, 'params'), validate(updateSchema), (req, res) => {
    const cur = ownedProblem(req.valid.params.id, req.user.id);
    const b = req.valid.body;
    db.prepare('UPDATE problems SET name = ?, level = ?, solved = ? WHERE id = ?')
      .run(b.name ?? cur.name, b.level ?? cur.level, b.solved === undefined ? cur.solved : Number(b.solved), cur.id);
    res.json({ problem: shape(db.prepare('SELECT * FROM problems WHERE id = ?').get(cur.id)) });
  });

  flat.delete('/:id', validate(problemParam, 'params'), (req, res) => {
    const cur = ownedProblem(req.valid.params.id, req.user.id);
    db.prepare('DELETE FROM problems WHERE id = ?').run(cur.id);
    res.status(204).end();
  });

  return { nested, flat };
};
