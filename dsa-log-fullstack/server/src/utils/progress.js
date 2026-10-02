function calculateProgress(solved, total) {
  const safeTotal = Number(total) || 0;
  const safeSolved = Number(solved) || 0;
  return safeTotal ? Math.round((safeSolved / safeTotal) * 100) : 0;
}

function topicStatus(solved, total) {
  const safeTotal = Number(total) || 0;
  const safeSolved = Number(solved) || 0;
  if (safeSolved === 0) return 'todo';
  if (safeTotal > 0 && safeSolved === safeTotal) return 'done';
  return 'doing';
}

module.exports = { calculateProgress, topicStatus };
