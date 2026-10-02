const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateProgress, topicStatus } = require('../src/utils/progress');

test('calculateProgress handles an empty topic', () => {
  assert.equal(calculateProgress(0, 0), 0);
});

test('calculateProgress rounds to the nearest whole percent', () => {
  assert.equal(calculateProgress(1, 3), 33);
  assert.equal(calculateProgress(2, 3), 67);
  assert.equal(calculateProgress(5, 5), 100);
});

test('topicStatus identifies not started, in progress and completed topics', () => {
  assert.equal(topicStatus(0, 0), 'todo');
  assert.equal(topicStatus(0, 5), 'todo');
  assert.equal(topicStatus(2, 5), 'doing');
  assert.equal(topicStatus(5, 5), 'done');
});

test('topicStatus does not mark a zero-problem topic as done', () => {
  assert.notEqual(topicStatus(0, 0), 'done');
});
