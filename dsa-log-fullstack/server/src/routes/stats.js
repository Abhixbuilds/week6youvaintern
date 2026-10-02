const express = require('express');

module.exports = db => {
  const r = express.Router();
  r.get('/', (req, res) => {
    const rows = db.prepare(`
      SELECT t.id, COUNT(p.id) AS total, COALESCE(SUM(p.solved), 0) AS solved
      FROM topics t LEFT JOIN problems p ON p.topic_id = t.id
      WHERE t.user_id = ? GROUP BY t.id`).all(req.user.id);
    const levels = db.prepare(`
      SELECT p.level, COUNT(*) AS total, SUM(p.solved) AS solved
      FROM problems p JOIN topics t ON t.id = p.topic_id
      WHERE t.user_id = ? GROUP BY p.level`).all(req.user.id);
    const totalProblems = rows.reduce((a, t) => a + t.total, 0);
    const solved = rows.reduce((a, t) => a + t.solved, 0);
    res.json({
      totalTopics: rows.length,
      topicsFinished: rows.filter(t => t.total > 0 && t.solved === t.total).length,
      totalProblems,
      solved,
      percent: totalProblems ? Math.round((solved / totalProblems) * 100) : 0,
      byLevel: Object.fromEntries(levels.map(l => [l.level, { total: l.total, solved: l.solved }])),
    });
  });
  return r;
};
