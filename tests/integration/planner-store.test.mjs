import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageAdapter, createPlannerStore } from '../../js/core/store.mjs';
import { PRIORITIES } from '../../js/core/activity.mjs';

test('Planner Store: full lifecycle CRUD operations', async () => {
  const store = createPlannerStore(new MemoryStorageAdapter());

  // 1. Create activity
  const created = await store.createActivity({
    title: 'Client Demo',
    date: '2026-11-13',
    startTime: '15:00',
    endTime: '16:00',
    priority: PRIORITIES.P1_URGENT,
    category: 'Work'
  });

  assert.ok(created.id);
  assert.equal(created.title, 'Client Demo');
  assert.equal(created.completed, false);

  // 2. Query activity
  const fetched = await store.getActivity(created.id);
  assert.equal(fetched.title, 'Client Demo');

  // 3. Update activity
  const updated = await store.updateActivity(created.id, {
    description: 'Prepare slide deck beforehand'
  });
  assert.equal(updated.description, 'Prepare slide deck beforehand');

  // 4. Toggle completion
  const toggled = await store.toggleActivity(created.id);
  assert.equal(toggled.completed, true);
  assert.ok(toggled.completedAt);

  // 5. Query pending tasks (should be empty now)
  const pending = await store.getPendingTasks();
  assert.equal(pending.length, 0);

  // 6. Delete activity
  const deleted = await store.deleteActivity(created.id);
  assert.equal(deleted, true);
  const reFetch = await store.getActivity(created.id);
  assert.equal(reFetch, null);
});

test('Planner Store: export and import data preserves state and rejects invalid JSON', async () => {
  const adapter = new MemoryStorageAdapter();
  const store = createPlannerStore(adapter);

  await store.createActivity({
    title: 'Backup Task',
    date: '2026-11-14',
    priority: PRIORITIES.P2_HIGH
  });

  const jsonDump = await store.exportData();
  assert.ok(jsonDump.includes('Backup Task'));

  // Corrupt JSON import throws error
  await assert.rejects(
    async () => store.importData('{ invalid json ]'),
    { message: /ERR_IMPORT_CORRUPT/ }
  );

  // Import into new store
  const store2 = createPlannerStore(new MemoryStorageAdapter());
  const importResult = await store2.importData(jsonDump);
  assert.equal(importResult.imported, 1);
  assert.equal(importResult.success, true);

  const importedList = await store2.queryActivities();
  assert.equal(importedList.length, 1);
  assert.equal(importedList[0].title, 'Backup Task');
});

