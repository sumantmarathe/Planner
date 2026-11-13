import test from 'node:test';
import assert from 'node:assert/strict';
import { IndexedDBStorageAdapter } from '../../js/core/store.mjs';

test('IndexedDB Adapter: _setupStores registers activities, habits, and finance stores', () => {
  const adapter = new IndexedDBStorageAdapter('TestDB', 'finance', 4);
  assert.equal(adapter.version, 4);

  const createdStores = new Map();
  const mockDb = {
    objectStoreNames: {
      contains: (name) => createdStores.has(name)
    },
    createObjectStore: (name, options) => {
      const storeObj = {
        name,
        options,
        indices: new Map(),
        createIndex: (idxName, keyPath, opts) => {
          storeObj.indices.set(idxName, { keyPath, opts });
        }
      };
      createdStores.set(name, storeObj);
      return storeObj;
    }
  };

  adapter._setupStores(mockDb);

  assert.ok(createdStores.has('activities'), 'activities store must be created');
  assert.ok(createdStores.has('habits'), 'habits store must be created');
  assert.ok(createdStores.has('finance'), 'finance store must be created');
});

test('IndexedDB Adapter: gracefully falls back if IDB transaction fails', async () => {
  const adapter = new IndexedDBStorageAdapter('TestDB', 'finance', 4);
  // Simulate mock fallback
  await adapter.save({ id: 'fin_test_1', amount: 5000, name: 'Salary' });
  const items = await adapter.getAll();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Salary');
});
