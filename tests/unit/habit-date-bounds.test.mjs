import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHabitModel,
  validateHabitInput,
  isDateScheduledByRule,
  generateOccurrences,
  calculateHabitStats,
  RECURRENCE_FREQUENCIES
} from '../../js/core/habit.mjs';
import { createPlannerStore } from '../../js/core/store.mjs';

test('Habit Date Bounds: validateHabitInput accepts optional startDate and endDate', () => {
  // Case 1: Both omitted
  const emptyDates = validateHabitInput({ title: 'Read Books' });
  assert.equal(emptyDates.startDate, null);
  assert.equal(emptyDates.endDate, null);

  // Case 2: Both provided
  const withDates = validateHabitInput({
    title: '30-Day Fitness Challenge',
    startDate: '2026-11-01',
    endDate: '2026-11-30'
  });
  assert.equal(withDates.startDate, '2026-11-01');
  assert.equal(withDates.endDate, '2026-11-30');

  // Case 3: Only startDate provided
  const startOnly = validateHabitInput({
    title: 'Morning Yoga',
    startDate: '2026-11-15',
    endDate: ''
  });
  assert.equal(startOnly.startDate, '2026-11-15');
  assert.equal(startOnly.endDate, null);

  // Case 4: Only endDate provided
  const endOnly = validateHabitInput({
    title: 'Exam Prep Study',
    endDate: '2026-12-15'
  });
  assert.equal(endOnly.startDate, null);
  assert.equal(endOnly.endDate, '2026-12-15');
});

test('Habit Date Bounds: isDateScheduledByRule strictly respects startDate and endDate', () => {
  const rule = {
    frequency: RECURRENCE_FREQUENCIES.DAILY,
    startDate: '2026-11-05',
    endDate: '2026-11-10'
  };

  assert.equal(isDateScheduledByRule('2026-11-04', rule), false, 'Before start date should not be scheduled');
  assert.equal(isDateScheduledByRule('2026-11-05', rule), true, 'On start date should be scheduled');
  assert.equal(isDateScheduledByRule('2026-11-08', rule), true, 'Inside date window should be scheduled');
  assert.equal(isDateScheduledByRule('2026-11-10', rule), true, 'On end date should be scheduled');
  assert.equal(isDateScheduledByRule('2026-11-11', rule), false, 'After end date should not be scheduled');
});

test('Habit Date Bounds: generateOccurrences bounds occurrences to habit active window', () => {
  const rule = {
    frequency: RECURRENCE_FREQUENCIES.DAILY,
    startDate: '2026-11-03',
    endDate: '2026-11-06'
  };

  const dates = generateOccurrences('2026-11-01', '2026-11-10', rule);
  assert.deepEqual(dates, ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
});

test('Habit Date Bounds: Store calendar expansion respects habit start and end dates', async () => {
  const store = createPlannerStore();

  const habit = await store.createHabit({
    title: 'Sprint Habit',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    recurrence: { frequency: RECURRENCE_FREQUENCIES.DAILY }
  });

  // Query before start date (2026-11-09)
  const before = await store.queryActivities({ date: '2026-11-09', includeHabits: true });
  assert.equal(before.some(a => a.habitId === habit.id), false, 'Must not appear before startDate');

  // Query on active date (2026-11-11)
  const during = await store.queryActivities({ date: '2026-11-11', includeHabits: true });
  assert.equal(during.some(a => a.habitId === habit.id), true, 'Must appear during active window');

  // Query after end date (2026-11-13)
  const after = await store.queryActivities({ date: '2026-11-13', includeHabits: true });
  assert.equal(after.some(a => a.habitId === habit.id), false, 'Must not appear after endDate');
});
