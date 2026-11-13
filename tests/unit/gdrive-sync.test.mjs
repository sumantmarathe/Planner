import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeDatasetsByTimestamp,
  GoogleDriveSyncEngine,
  formatSyncTimestamp
} from '../../js/core/gdrive-sync.mjs';

test('GDrive Sync: mergeDatasetsByTimestamp merges local and remote by updatedAt', () => {
  const local = [
    { id: '1', title: 'Local newer', updatedAt: '2026-11-13T12:00:00Z', completed: true },
    { id: '2', title: 'Local older', updatedAt: '2026-11-13T10:00:00Z', completed: false },
    { id: '3', title: 'Only local', updatedAt: '2026-11-13T11:00:00Z', completed: false }
  ];

  const remote = [
    { id: '1', title: 'Remote older', updatedAt: '2026-11-13T11:00:00Z', completed: false },
    { id: '2', title: 'Remote newer', updatedAt: '2026-11-13T12:30:00Z', completed: true },
    { id: '4', title: 'Only remote', updatedAt: '2026-11-13T09:00:00Z', completed: false }
  ];

  const merged = mergeDatasetsByTimestamp(local, remote);
  assert.equal(merged.length, 4);

  // ID 1 should take local (newer)
  const item1 = merged.find(i => i.id === '1');
  assert.equal(item1.title, 'Local newer');
  assert.equal(item1.completed, true);

  // ID 2 should take remote (newer)
  const item2 = merged.find(i => i.id === '2');
  assert.equal(item2.title, 'Remote newer');
  assert.equal(item2.completed, true);

  // ID 3 and ID 4 preserved
  assert.ok(merged.find(i => i.id === '3'));
  assert.ok(merged.find(i => i.id === '4'));
});

test('GDrive Sync Engine: handles authentication and mocked Drive REST interactions', async () => {
  // Mock fetch client simulating Google Drive REST v3 API
  let driveFiles = new Map();

  const mockFetch = async (url, options = {}) => {
    const urlStr = url.toString();

    // 1. Search files in appDataFolder
    if (urlStr.includes('/drive/v3/files?') && (!options.method || options.method === 'GET')) {
      const files = Array.from(driveFiles.entries()).map(([id, item]) => ({
        id,
        name: item.name
      }));
      return {
        ok: true,
        status: 200,
        json: async () => ({ files })
      };
    }

    // 2. Download file content
    if (urlStr.includes('/drive/v3/files/') && urlStr.includes('alt=media')) {
      const match = urlStr.match(/\/files\/([^?]+)/);
      const fileId = match ? match[1] : null;
      const file = driveFiles.get(fileId);
      if (!file) {
        return { ok: false, status: 404, statusText: 'Not Found' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => file.content
      };
    }

    // 3. Create file (multipart upload)
    if (urlStr.includes('/upload/drive/v3/files') && options.method === 'POST') {
      const newId = 'drive_file_' + Date.now();
      driveFiles.set(newId, { name: 'dayplanner_database.json', content: [] });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: newId, name: 'dayplanner_database.json' })
      };
    }

    // 4. Update file
    if (urlStr.includes('/upload/drive/v3/files/') && options.method === 'PATCH') {
      const match = urlStr.match(/\/files\/([^?]+)/);
      const fileId = match ? match[1] : null;
      // In PATCH body is JSON string
      const content = JSON.parse(options.body);
      driveFiles.set(fileId, { name: 'dayplanner_database.json', content });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: fileId, name: 'dayplanner_database.json' })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const engine = new GoogleDriveSyncEngine({
    fetchImpl: mockFetch,
    storageKey: 'test_gdrive_auth'
  });

  // Set mock access token
  engine.setAuthToken('mock_access_token_123', 3600);
  assert.equal(engine.isAuthenticated(), true);

  // Sync sample data
  const sampleLocal = [
    { id: 'act_101', title: 'Synced Task', date: '2026-11-13', completed: false, updatedAt: '2026-11-13T12:00:00Z' }
  ];

  const syncResult = await engine.syncNow(sampleLocal);
  assert.equal(syncResult.status.state, 'SYNCED');
  assert.equal(syncResult.merged.length, 1);
  assert.equal(syncResult.merged[0].title, 'Synced Task');

  // Verify drive file now exists in mock
  assert.ok(engine.getFileId());
});

