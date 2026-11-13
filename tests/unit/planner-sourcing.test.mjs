import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerStore } from '../../js/core/store.mjs';
import { PRIORITIES } from '../../js/core/activity.mjs';
import { RECURRENCE_FREQUENCIES, HABIT_CATEGORIES } from '../../js/core/habit.mjs';
import { getTodayISO } from '../../js/core/calendar-utils.mjs';

test('Planner Sourcing: scheduleTaskForDate assigns backlog task to specific date and time', async () => {
  const store = createPlannerStore();

  // Create an unscheduled or future task in the Tasks tab
  const task = await store.createActivity({
    title: 'Review Quarterly Budget',
    priority: PRIORITIES.P1_URGENT,
    date: '2026-11-20',
    description: 'Finance review'
  });

  assert.equal(task.title, 'Review Quarterly Budget');
  assert.equal(task.date, '2026-11-20');

  // Schedule task for today (e.g. 2026-11-13) with time slot
  const updated = await store.scheduleTaskForDate(task.id, '2026-11-13', {
    startTime: '10:00',
    endTime: '11:00'
  });

  assert.equal(updated.id, task.id);
  assert.equal(updated.date, '2026-11-13');
  assert.equal(updated.startTime, '10:00');
  assert.equal(updated.endTime, '11:00');

  // Query planner activities for 2026-11-13
  const dayItems = await store.queryActivities({ date: '2026-11-13' });
  const found = dayItems.find(item => item.id === task.id);
  assert.ok(found, 'Task must appear on 2026-11-13 plan');
  assert.equal(found.startTime, '10:00');
});

test('Planner Sourcing: planner queries fetch both tasks and habits with correct type flags', async () => {
  const store = createPlannerStore();

  // 1. Create a task
  const task = await store.createActivity({
    title: 'Team Standup',
    priority: PRIORITIES.P2_HIGH,
    date: '2026-11-13',
    startTime: '09:00',
    endTime: '09:30'
  });

  // 2. Create a daily habit
  const habit = await store.createHabit({
    title: 'Daily Meditation',
    category: HABIT_CATEGORIES[0],
    priority: PRIORITIES.P3_MEDIUM,
    recurrence: { frequency: RECURRENCE_FREQUENCIES.DAILY }
  });

  // Query for 2026-11-13
  const items = await store.queryActivities({ date: '2026-11-13' });
  
  const taskItem = items.find(i => i.id === task.id);
  assert.ok(taskItem, 'Task must be returned');
  assert.equal(taskItem.isHabit, false);

  const habitItem = items.find(i => i.habitId === habit.id);
  assert.ok(habitItem, 'Habit occurrence must be returned');
  assert.equal(habitItem.isHabit, true);
});

test('Planner Sourcing: automatically includes overdue unticked tasks when querying today', async () => {
  const store = createPlannerStore();
  const today = getTodayISO();

  // Create an overdue unticked task from past date
  const overdueTask = await store.createActivity({
    title: 'Pay Electricity Bill',
    priority: PRIORITIES.P1_URGENT,
    date: '2026-11-01'
  });

  // Query activities for today with includeOverdueForToday
  const todayItems = await store.queryActivities({ date: today, includeOverdueForToday: true });
  const found = todayItems.find(item => item.id === overdueTask.id);
  assert.ok(found, 'Overdue unticked task must automatically be fetched into today plan');
});
