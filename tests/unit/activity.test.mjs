import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createActivityModel,
  validateActivityInput,
  toggleActivityCompletion,
  PRIORITIES
} from '../../js/core/activity.mjs';

test('Activity Model: validates required fields', () => {
  // Empty title must fail
  assert.throws(
    () => validateActivityInput({ title: '', date: '2026-11-13' }),
    { message: /ERR_VALIDATION_TITLE/ }
  );

  // Missing or invalid date must fail
  assert.throws(
    () => validateActivityInput({ title: 'Workout', date: 'invalid-date' }),
    { message: /ERR_VALIDATION_DATE/ }
  );

  // Valid input succeeds and defaults priority to P3_MEDIUM
  const valid = validateActivityInput({
    title: 'Morning Run',
    date: '2026-11-13',
    priority: PRIORITIES.P2_HIGH
  });
  assert.equal(valid.title, 'Morning Run');
  assert.equal(valid.priority, 'P2_HIGH');
});

test('Activity Model: createActivityModel sets defaults and unique id', () => {
  const item = createActivityModel({
    title: 'Team Standup',
    date: '2026-11-13',
    startTime: '10:00',
    endTime: '10:30',
    priority: PRIORITIES.P1_URGENT,
    category: 'Work'
  });

  assert.ok(item.id && typeof item.id === 'string');
  assert.equal(item.completed, false);
  assert.equal(item.completedAt, null);
  assert.ok(item.createdAt);
  assert.ok(item.updatedAt);
  assert.equal(item.priority, 'P1_URGENT');
});

test('Activity Model: toggleActivityCompletion toggles state and updates timestamp', () => {
  const item = createActivityModel({
    title: 'Review PR',
    date: '2026-11-13',
    priority: PRIORITIES.P2_HIGH
  });

  // Toggle to complete
  const completed = toggleActivityCompletion(item);
  assert.equal(completed.completed, true);
  assert.ok(completed.completedAt);

  // Toggle back to incomplete
  const undone = toggleActivityCompletion(completed);
  assert.equal(undone.completed, false);
  assert.equal(undone.completedAt, null);
});

