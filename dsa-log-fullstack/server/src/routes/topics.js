const express = require('express');
const { z } = require('zod');
const { ApiError } = require('../middleware/errors');
const { validate } = require('../middleware/validate');
const { calculateProgress } = require('../utils/progress');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['todo', 'doing', 'done']).optional(),
});
const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  description: z.string().trim().max(300).optional(),
}).strict();
const updateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(300).optional(),
  notes: z.string().max(5000).optional(),
}).strict().refine(o => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

const shape = r => ({
  id: r.id, title: r.title, description: r.description, notes: r.notes, createdAt: r.created_at,
  progress: { solved: r.solved, total: r.total, percent: calculateProgress(r.solved, r.total) },
});

module.exports = db => {
  const r = express.Router();
  const SELECT = `
    SELECT t.*, COUNT(p.id) AS total, COALESCE(SUM(p.solved), 0) AS solved
    FROM topics t LEFT JOIN problems p ON p.topic_id = t.id`;

  const findOwned = (id, userId) => {
    const row = db.prepare(`${SELECT} WHERE t.id = ? AND t.user_id = ? GROUP BY t.id`).get(id, userId);
    if (!row) throw new ApiError(404, 'Topic not found'); // 404 also for other users' topics
    return row;
  };

  r.get('/', validate(listQuery, 'query'), (req, res) => {
    const { search, status } = req.valid.query;
    const filters = ['t.user_id = ?', 't.title LIKE ?'];
    const params = [req.user.id, `%${search || ''}%`];
    let having = '';

    if (status === 'todo') {
      having = 'HAVING COALESCE(SUM(p.solved), 0) = 0';
    } else if (status === 'doing') {
      having = 'HAVING COALESCE(SUM(p.solved), 0) > 0 AND COUNT(p.id) > COALESCE(SUM(p.solved), 0)';
    } else if (status === 'done') {
      having = 'HAVING COUNT(p.id) > 0 AND COUNT(p.id) = COALESCE(SUM(p.solved), 0)';
    }

    const rows = db.prepare(`${SELECT} WHERE ${filters.join(' AND ')} GROUP BY t.id ${having} ORDER BY t.id`).all(...params);
    res.json({ count: rows.length, topics: rows.map(shape) });
  });

  r.get('/:id', validate(idParam, 'params'), (req, res) => {
    const topic = findOwned(req.valid.params.id, req.user.id);
    const problems = db.prepare('SELECT id, name, level, solved FROM problems WHERE topic_id = ? ORDER BY id').all(topic.id)
      .map(p => ({ ...p, solved: !!p.solved }));
    res.json({ topic: { ...shape(topic), problems } });
  });

  r.post('/', validate(createSchema), (req, res) => {
    const { title, description = '' } = req.valid.body;
    const id = db.prepare('INSERT INTO topics (user_id, title, description) VALUES (?, ?, ?)').run(req.user.id, title, description).lastInsertRowid;
    res.status(201).json({ topic: shape(findOwned(id, req.user.id)) });
  });

  r.patch('/:id', validate(idParam, 'params'), validate(updateSchema), (req, res) => {
    const current = findOwned(req.valid.params.id, req.user.id);
    const next = { title: current.title, description: current.description, notes: current.notes, ...req.valid.body };
    db.prepare('UPDATE topics SET title = ?, description = ?, notes = ? WHERE id = ?').run(next.title, next.description, next.notes, current.id);
    res.json({ topic: shape(findOwned(current.id, req.user.id)) });
  });

  r.delete('/:id', validate(idParam, 'params'), (req, res) => {
    const topic = findOwned(req.valid.params.id, req.user.id);
    db.prepare('DELETE FROM topics WHERE id = ?').run(topic.id); // problems removed by ON DELETE CASCADE
    res.status(204).end();
  });

  return r;
};
