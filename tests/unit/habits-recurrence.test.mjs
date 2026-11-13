import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDateScheduledByRule,
  generateOccurrences,
  createHabitModel,
  toggleHabitCompletion,
  calculateHabitStats,
  RECURRENCE_FREQUENCIES
} from '../../js/core/habit.mjs';

test('Recurrence Engine: correctly identifies scheduled dates', () => {
  // DAILY
  const dailyRule = { frequency: RECURRENCE_FREQUENCIES.DAILY };
  assert.equal(isDateScheduledByRule('2026-11-13', dailyRule), true);

  // WEEKDAYS (2026-11-13 is Friday, 2026-11-14 is Saturday)
  const weekdayRule = { frequency: RECURRENCE_FREQUENCIES.WEEKDAYS };
  assert.equal(isDateScheduledByRule('2026-11-13', weekdayRule), true);  // Friday
  assert.equal(isDateScheduledByRule('2026-11-14', weekdayRule), false); // Saturday
  assert.equal(isDateScheduledByRule('2026-11-15', weekdayRule), false); // Sunday
  assert.equal(isDateScheduledByRule('2026-11-16', weekdayRule), true);  // Monday

  // WEEKENDS
  const weekendRule = { frequency: RECURRENCE_FREQUENCIES.WEEKENDS };
  assert.equal(isDateScheduledByRule('2026-11-13', weekendRule), false);
  assert.equal(isDateScheduledByRule('2026-11-14', weekendRule), true);
  assert.equal(isDateScheduledByRule('2026-11-15', weekendRule), true);

  // WEEKLY on Mon, Wed, Fri (days: 1, 3, 5)
  const mwfRule = { frequency: RECURRENCE_FREQUENCIES.WEEKLY, daysOfWeek: [1, 3, 5] };
  assert.equal(isDateScheduledByRule('2026-11-09', mwfRule), true);  // Monday
  assert.equal(isDateScheduledByRule('2026-11-10', mwfRule), false); // Tuesday
  assert.equal(isDateScheduledByRule('2026-11-11', mwfRule), true);  // Wednesday
});

test('Recurrence Engine: generateOccurrences expands dates within range', () => {
  const mwfRule = { frequency: RECURRENCE_FREQUENCIES.WEEKLY, daysOfWeek: [1, 3, 5] };
  // 2026-11-09 (Mon) to 2026-11-15 (Sun) -> Mon(09), Wed(11), Fri(13)
  const dates = generateOccurrences('2026-11-09', '2026-11-15', mwfRule);
  assert.deepEqual(dates, ['2026-11-09', '2026-11-11', '2026-11-13']);
});

test('Habit Model: validates and creates habit record', () => {
  // Empty title throws error
  assert.throws(
    () => createHabitModel({ title: '' }),
    { message: /ERR_VALIDATION_TITLE/ }
  );

  const habit = createHabitModel({
    title: 'Morning Yoga',
    category: 'Mindfulness',
    priority: 'P2_HIGH',
    recurrence: { frequency: RECURRENCE_FREQUENCIES.DAILY }
  });

  assert.ok(habit.id);
  assert.equal(habit.title, 'Morning Yoga');
  assert.equal(habit.category, 'Mindfulness');
  assert.deepEqual(habit.completions, {});
});

test('Habit Model: toggles completions for specific dates', () => {
  const habit = createHabitModel({
    title: 'Read 20 pages',
    category: 'Learning'
  });

  // Toggle on
  const completed = toggleHabitCompletion(habit, '2026-11-13');
  assert.equal(completed.completions['2026-11-13'], true);

  // Toggle off
  const undone = toggleHabitCompletion(completed, '2026-11-13');
  assert.equal(undone.completions['2026-11-13'], undefined);
});

test('Habit Analytics: accurately calculates current streak, best streak, and completion rate', () => {
  const habit = createHabitModel({
    title: 'Daily Exercise',
    recurrence: { frequency: RECURRENCE_FREQUENCIES.DAILY }
  });

  // Mark completed for 3 consecutive days: Nov 11, Nov 12, Nov 13
  habit.completions['2026-11-11'] = true;
  habit.completions['2026-11-12'] = true;
  habit.completions['2026-11-13'] = true;

  // Earlier streak: Nov 5, Nov 6 (2 days)
  habit.completions['2026-11-05'] = true;
  habit.completions['2026-11-06'] = true;

  const stats = calculateHabitStats(habit, '2026-11-13');
  assert.equal(stats.currentStreak, 3);
  assert.equal(stats.bestStreak, 3);
  assert.equal(stats.totalCompletions, 5);
  assert.equal(stats.historyLast14d.length, 14);

  // Verify today in history is completed
  const todayEntry = stats.historyLast14d.find(e => e.date === '2026-11-13');
  assert.ok(todayEntry);
  assert.equal(todayEntry.completed, true);
});
