import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageAdapter, createPlannerStore } from '../../js/core/store.mjs';
import { RECURRENCE_FREQUENCIES } from '../../js/core/habit.mjs';

test('Planner Store with Habits: full lifecycle and calendar expansion', async () => {
  const store = createPlannerStore(new MemoryStorageAdapter(), new MemoryStorageAdapter());

  // 1. Create a habit
  const habit = await store.createHabit({
    title: 'Daily Meditation',
    category: 'Mindfulness',
    priority: 'P2_HIGH',
    timeOfDay: 'morning',
    startTime: '07:00',
    recurrence: { frequency: RECURRENCE_FREQUENCIES.DAILY }
  });

  assert.ok(habit.id);
  assert.equal(habit.title, 'Daily Meditation');

  // 2. Query habits
  const allHabits = await store.getAllHabits();
  assert.equal(allHabits.length, 1);

  // 3. Toggle habit date
  const toggled = await store.toggleHabitDate(habit.id, '2026-11-13');
  assert.equal(toggled.completed, true);

  // 4. Query activities for that date (should include expanded habit activity)
  const activities = await store.queryActivities({ date: '2026-11-13' });
  const habitAct = activities.find(a => a.habitId === habit.id);
  assert.ok(habitAct);
  assert.equal(habitAct.title, 'Daily Meditation');
  assert.equal(habitAct.completed, true);
  assert.equal(habitAct.isHabit, true);

  // 5. Toggling through store.toggleActivity toggles habit date
  await store.toggleActivity(habitAct.id);
  const updatedHabit = await store.getHabit(habit.id);
  assert.equal(updatedHabit.completions['2026-11-13'], undefined);

  // 6. Delete habit
  const deleted = await store.deleteHabit(habit.id);
  assert.equal(deleted, true);
  const reQuery = await store.getAllHabits();
  assert.equal(reQuery.length, 0);
});
