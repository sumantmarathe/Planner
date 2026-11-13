import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageAdapter, createPlannerStore } from '../../js/core/store.mjs';
import { RECURRENCE_FREQUENCIES } from '../../js/core/habit.mjs';

test('Task vs Habit Separation: getPendingTasks excludes habits from task backlog', async () => {
  const store = createPlannerStore(new MemoryStorageAdapter(), new MemoryStorageAdapter());

  // 1. Create a regular task
  const task = await store.createActivity({
    title: 'Prepare Presentation Slides',
    date: '2026-11-13',
    priority: 'P1_URGENT',
    category: 'Work'
  });

  // 2. Create a recurring habit
  const habit = await store.createHabit({
    title: 'Morning 5km Run',
    category: 'Fitness',
    priority: 'P2_HIGH',
    timeOfDay: 'morning',
    recurrence: { frequency: RECURRENCE_FREQUENCIES.DAILY }
  });

  // 3. Query pending tasks: MUST contain only the task, NOT the habit
  const pendingTasks = await store.getPendingTasks('2026-11-13');
  assert.equal(pendingTasks.length, 1);
  assert.equal(pendingTasks[0].id, task.id);
  assert.equal(pendingTasks[0].title, 'Prepare Presentation Slides');
  assert.ok(!pendingTasks[0].isHabit, 'Task must not be a habit');

  // 4. Query calendar activities: MUST contain both task and expanded habit
  const calendarActivities = await store.queryActivities({ date: '2026-11-13', includeHabits: true });
  assert.equal(calendarActivities.length, 2);
  assert.ok(calendarActivities.some(a => a.id === task.id));
  assert.ok(calendarActivities.some(a => a.isHabit === true && a.habitId === habit.id));

  // 5. Query activities with includeHabits: false returns only task
  const tasksOnly = await store.queryActivities({ date: '2026-11-13', includeHabits: false });
  assert.equal(tasksOnly.length, 1);
  assert.equal(tasksOnly[0].id, task.id);
});

