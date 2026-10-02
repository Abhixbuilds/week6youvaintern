const { performance } = require('node:perf_hooks');
const { createDb } = require('../src/db');

const db = createDb(':memory:');
const userId = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
  .run('Profile User', 'profile@example.com', 'not-used').lastInsertRowid;

const addTopic = db.prepare('INSERT INTO topics (user_id, title, description) VALUES (?, ?, ?)');
const addProblem = db.prepare('INSERT INTO problems (topic_id, name, level) VALUES (?, ?, ?)');
const markSolved = db.prepare('UPDATE problems SET solved = 1 WHERE topic_id = ? AND name = ?');

db.transaction(() => {
  for (let i = 0; i < 1000; i++) {
    const topicId = addTopic.run(userId, `Topic ${i}`, 'Profile benchmark').lastInsertRowid;
    for (let j = 0; j < 5; j++) {
      addProblem.run(topicId, `Problem ${i}-${j}`, j === 0 ? 'Easy' : 'Medium');
    }
    if (i % 3 === 0) markSolved.run(topicId, `Problem ${i}-0`);
  }
})();

const baseline = db.prepare(`
  SELECT t.*, COUNT(p.id) AS total, COALESCE(SUM(p.solved), 0) AS solved
  FROM topics t LEFT JOIN problems p ON p.topic_id = t.id
  WHERE t.user_id = ? AND t.title LIKE ?
  GROUP BY t.id ORDER BY t.id
`);

const optimized = db.prepare(`
  SELECT t.*, COUNT(p.id) AS total, COALESCE(SUM(p.solved), 0) AS solved
  FROM topics t LEFT JOIN problems p ON p.topic_id = t.id
  WHERE t.user_id = ? AND t.title LIKE ?
  GROUP BY t.id
  HAVING COALESCE(SUM(p.solved), 0) = 0
  ORDER BY t.id
`);

const runs = 50;
function measure(statement, filterInJs = false) {
  const start = performance.now();
  let count = 0;
  for (let i = 0; i < runs; i++) {
    const rows = statement.all(userId, '%Topic%');
    count = filterInJs
      ? rows.filter(row => row.solved === 0).length
      : rows.length;
  }
  return { ms: performance.now() - start, count };
}

const baselineResult = measure(baseline, true);
const optimizedResult = measure(optimized, false);
const improvement = baselineResult.ms
  ? ((baselineResult.ms - optimizedResult.ms) / baselineResult.ms) * 100
  : 0;

console.log('DSA Log Week 5 database profile');
console.log(`Dataset: 1,000 topics x 5 problems`);
console.log(`Runs per query: ${runs}`);
console.log(`Baseline: fetch all matching topics, then filter in JavaScript: ${baselineResult.ms.toFixed(2)} ms`);
console.log(`Optimized: filter topic status in SQL HAVING: ${optimizedResult.ms.toFixed(2)} ms`);
console.log(`Matching rows: baseline=${baselineResult.count}, optimized=${optimizedResult.count}`);
console.log(`Measured improvement: ${improvement.toFixed(1)}%`);

db.close();
