/**
 * Local-First Storage Engine & Store
 */

import {
  createActivityModel,
  toggleActivityCompletion,
  validateActivityInput
} from './activity.mjs';
import { filterUntickedTasks } from './calendar-utils.mjs';

/**
 * In-memory storage adapter for unit tests & node headless environments
 */
export class MemoryStorageAdapter {
  constructor() {
    this.items = new Map();
  }

  async getAll() {
    return Array.from(this.items.values());
  }

  async getById(id) {
    return this.items.get(id) || null;
  }

  async save(activity) {
    this.items.set(activity.id, { ...activity });
    return this.items.get(activity.id);
  }

  async remove(id) {
    return this.items.delete(id);
  }

  async clear() {
    this.items.clear();
  }

  async bulkSave(activities) {
    for (const a of activities) {
      this.items.set(a.id, { ...a });
    }
  }
}

/**
 * LocalStorage adapter for browser environments without IndexedDB or for fallback
 */
export class LocalStorageAdapter {
  constructor(storageKey = 'dayplanner_activities_v1') {
    this.storageKey = storageKey;
  }

  _read() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _write(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      throw new Error(`ERR_STORAGE_QUOTA: Storage write failed (${e.message})`);
    }
  }

  async getAll() {
    return this._read();
  }

  async getById(id) {
    const list = this._read();
    return list.find(item => item.id === id) || null;
  }

  async save(activity) {
    const list = this._read();
    const idx = list.findIndex(item => item.id === activity.id);
    if (idx >= 0) {
      list[idx] = { ...activity };
    } else {
      list.push({ ...activity });
    }
    this._write(list);
    return activity;
  }

  async remove(id) {
    const list = this._read();
    const filtered = list.filter(item => item.id !== id);
    const existed = filtered.length !== list.length;
    this._write(filtered);
    return existed;
  }

  async clear() {
    localStorage.removeItem(this.storageKey);
  }

  async bulkSave(activities) {
    const list = this._read();
    const map = new Map(list.map(i => [i.id, i]));
    for (const a of activities) {
      map.set(a.id, a);
    }
    this._write(Array.from(map.values()));
  }
}

/**
 * IndexedDB adapter for high-capacity local-first browser storage
 */
export class IndexedDBStorageAdapter {
  constructor(dbName = 'DayPlannerDB', storeName = 'activities', version = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.db = null;
  }

  async _getDb() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('completed', 'completed', { unique: false });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAll() {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getById(id) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async save(activity) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(activity);
      req.onsuccess = () => resolve(activity);
      req.onerror = () => reject(req.error);
    });
  }

  async remove(id) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clear() {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async bulkSave(activities) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      for (const a of activities) {
        store.put(a);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/**
 * Domain-level Planner Store
 */
export function createPlannerStore(storageAdapter) {
  const adapter = storageAdapter || (typeof indexedDB !== 'undefined'
    ? new IndexedDBStorageAdapter()
    : (typeof localStorage !== 'undefined' ? new LocalStorageAdapter() : new MemoryStorageAdapter()));

  return {
    async createActivity(rawInput) {
      const activity = createActivityModel(rawInput);
      await adapter.save(activity);
      return activity;
    },

    async updateActivity(id, updates) {
      const existing = await adapter.getById(id);
      if (!existing) {
        throw new Error(`ERR_ACTIVITY_NOT_FOUND: Activity ${id} does not exist`);
      }

      const merged = {
        ...existing,
        ...updates,
        id: existing.id, // prevent overwriting ID
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      // Validate core integrity
      validateActivityInput({
        title: merged.title,
        date: merged.date,
        priority: merged.priority,
        description: merged.description,
        startTime: merged.startTime,
        endTime: merged.endTime,
        category: merged.category
      });

      await adapter.save(merged);
      return merged;
    },

    async toggleActivity(id) {
      const existing = await adapter.getById(id);
      if (!existing) {
        throw new Error(`ERR_ACTIVITY_NOT_FOUND: Activity ${id} does not exist`);
      }
      const toggled = toggleActivityCompletion(existing);
      await adapter.save(toggled);
      return toggled;
    },

    async deleteActivity(id) {
      return await adapter.remove(id);
    },

    async getActivity(id) {
      return await adapter.getById(id);
    },

    async queryActivities(options = {}) {
      let items = await adapter.getAll();

      if (options.date) {
        items = items.filter(a => a.date === options.date);
      }
      if (options.startDate) {
        items = items.filter(a => a.date >= options.startDate);
      }
      if (options.endDate) {
        items = items.filter(a => a.date <= options.endDate);
      }
      if (options.priority) {
        items = items.filter(a => a.priority === options.priority);
      }
      if (typeof options.completed === 'boolean') {
        items = items.filter(a => a.completed === options.completed);
      }
      if (options.category) {
        items = items.filter(a => a.category.toLowerCase() === options.category.toLowerCase());
      }
      if (options.searchQuery) {
        const q = options.searchQuery.toLowerCase();
        items = items.filter(a =>
          a.title.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          a.category.toLowerCase().includes(q)
        );
      }

      // Sort by start time then title
      return items.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const timeA = a.startTime || '99:99';
        const timeB = b.startTime || '99:99';
        return timeA.localeCompare(timeB);
      });
    },

    async getPendingTasks(referenceDateIso) {
      const items = await adapter.getAll();
      return filterUntickedTasks(items, referenceDateIso);
    },

    async exportData() {
      const items = await adapter.getAll();
      const payload = {
        app: 'DayPlanner',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        count: items.length,
        activities: items
      };
      return JSON.stringify(payload, null, 2);
    },

    async importData(jsonString) {
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (e) {
        throw new Error(`ERR_IMPORT_CORRUPT: Invalid JSON string (${e.message})`);
      }

      const activities = Array.isArray(parsed) ? parsed : (parsed.activities || []);
      if (!Array.isArray(activities)) {
        throw new Error('ERR_IMPORT_CORRUPT: Payload must contain activity list');
      }

      const validRecords = [];
      for (const raw of activities) {
        try {
          const validated = validateActivityInput(raw);
          validRecords.push({
            id: raw.id || createActivityModel(raw).id,
            ...validated,
            completed: Boolean(raw.completed),
            completedAt: raw.completedAt || null,
            createdAt: raw.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch {
          // Skip invalid records
        }
      }

      await adapter.bulkSave(validRecords);
      return {
        imported: validRecords.length,
        success: true
      };
    }
  };
}

