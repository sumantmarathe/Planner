/**
 * Local-First Storage Engine & Store with Habit & Activity Integration
 */

import {
  createActivityModel,
  toggleActivityCompletion,
  validateActivityInput,
  PRIORITIES
} from './activity.mjs';
import {
  formatDateISO,
  parseDateISO,
  getTodayISO,
  filterUntickedTasks
} from './calendar-utils.mjs';
import {
  createHabitModel,
  toggleHabitCompletion,
  validateHabitInput,
  generateOccurrences,
  isDateScheduledByRule
} from './habit.mjs';

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

  async save(item) {
    this.items.set(item.id, { ...item });
    return this.items.get(item.id);
  }

  async remove(id) {
    return this.items.delete(id);
  }

  async clear() {
    this.items.clear();
  }

  async bulkSave(items) {
    for (const item of items) {
      this.items.set(item.id, { ...item });
    }
  }
}

/**
 * LocalStorage adapter for browser environments
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

  async save(item) {
    const list = this._read();
    const idx = list.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      list[idx] = { ...item };
    } else {
      list.push({ ...item });
    }
    this._write(list);
    return item;
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

  async bulkSave(items) {
    const list = this._read();
    const map = new Map(list.map(i => [i.id, i]));
    for (const item of items) {
      map.set(item.id, item);
    }
    this._write(Array.from(map.values()));
  }
}

/**
 * IndexedDB adapter for high-capacity local-first browser storage
 */
export class IndexedDBStorageAdapter {
  constructor(dbName = 'DayPlannerDB', storeName = 'activities', version = 2) {
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
        if (!db.objectStoreNames.contains('activities')) {
          const actStore = db.createObjectStore('activities', { keyPath: 'id' });
          actStore.createIndex('date', 'date', { unique: false });
          actStore.createIndex('priority', 'priority', { unique: false });
          actStore.createIndex('completed', 'completed', { unique: false });
        }
        if (!db.objectStoreNames.contains('habits')) {
          db.createObjectStore('habits', { keyPath: 'id' });
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

  async save(item) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
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

  async bulkSave(items) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/**
 * Domain-level Unified Planner & Habit Store
 */
export function createPlannerStore(customActAdapter, customHabitAdapter) {
  let actAdapter = customActAdapter;
  let habitAdapter = customHabitAdapter;

  if (actAdapter && !habitAdapter) {
    habitAdapter = new MemoryStorageAdapter();
  }

  if (!actAdapter) {
    if (typeof indexedDB !== 'undefined') {
      actAdapter = new IndexedDBStorageAdapter('DayPlannerDB', 'activities', 2);
      habitAdapter = new IndexedDBStorageAdapter('DayPlannerDB', 'habits', 2);
    } else if (typeof localStorage !== 'undefined') {
      actAdapter = new LocalStorageAdapter('dayplanner_activities_v1');
      habitAdapter = new LocalStorageAdapter('dayplanner_habits_v1');
    } else {
      actAdapter = new MemoryStorageAdapter();
      habitAdapter = new MemoryStorageAdapter();
    }
  }

  return {
    // ------------------------------------
    // ACTIVITIES CRUD
    // ------------------------------------
    async createActivity(rawInput) {
      const activity = createActivityModel(rawInput);
      await actAdapter.save(activity);
      return activity;
    },

    async updateActivity(id, updates) {
      if (id.startsWith('hab_act__')) {
        const parts = id.split('__');
        const habitId = parts[1];
        const dateIso = parts[2];
        if (typeof updates.completed === 'boolean') {
          await this.toggleHabitDate(habitId, dateIso);
          return { id, ...updates };
        }
      }

      const existing = await actAdapter.getById(id);
      if (!existing) {
        throw new Error(`ERR_ACTIVITY_NOT_FOUND: Activity ${id} does not exist`);
      }

      const merged = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      validateActivityInput({
        title: merged.title,
        date: merged.date,
        priority: merged.priority,
        description: merged.description,
        startTime: merged.startTime,
        endTime: merged.endTime,
        category: merged.category
      });

      await actAdapter.save(merged);
      return merged;
    },

    async toggleActivity(id) {
      if (id.startsWith('hab_act__')) {
        const parts = id.split('__');
        const habitId = parts[1];
        const dateIso = parts[2];
        const res = await this.toggleHabitDate(habitId, dateIso);
        return {
          id,
          completed: res.completed,
          completedAt: res.completed ? new Date().toISOString() : null,
          title: res.habit.title
        };
      }

      const existing = await actAdapter.getById(id);
      if (!existing) {
        throw new Error(`ERR_ACTIVITY_NOT_FOUND: Activity ${id} does not exist`);
      }
      const toggled = toggleActivityCompletion(existing);
      await actAdapter.save(toggled);
      return toggled;
    },

    async deleteActivity(id) {
      if (id.startsWith('hab_act__')) return false;
      return await actAdapter.remove(id);
    },

    async getActivity(id) {
      if (id.startsWith('hab_act__')) {
        const parts = id.split('__');
        const habitId = parts[1];
        const dateIso = parts[2];
        const habit = await habitAdapter.getById(habitId);
        if (!habit) return null;
        return {
          id,
          habitId: habit.id,
          title: habit.title,
          date: dateIso,
          priority: habit.priority,
          category: habit.category,
          completed: Boolean(habit.completions && habit.completions[dateIso]),
          isHabit: true
        };
      }
      return await actAdapter.getById(id);
    },

    async queryActivities(options = {}) {
      let items = await actAdapter.getAll();
      const habits = await habitAdapter.getAll();

      let dateRangeStart = options.startDate || options.date;
      let dateRangeEnd = options.endDate || options.date;

      if (dateRangeStart && dateRangeEnd) {
        for (const habit of habits) {
          const occDates = generateOccurrences(dateRangeStart, dateRangeEnd, habit.recurrence);
          for (const d of occDates) {
            const isCompleted = Boolean(habit.completions && habit.completions[d]);
            items.push({
              id: `hab_act__${habit.id}__${d}`,
              habitId: habit.id,
              title: habit.title,
              description: habit.description || `Habit (${habit.timeOfDay})`,
              date: d,
              startTime: habit.startTime || null,
              endTime: habit.endTime || null,
              priority: habit.priority || PRIORITIES.P3_MEDIUM,
              category: habit.category || 'Habit',
              completed: isCompleted,
              completedAt: isCompleted ? (habit.updatedAt || new Date().toISOString()) : null,
              createdAt: habit.createdAt,
              updatedAt: habit.updatedAt,
              isHabit: true
            });
          }
        }
      }

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

      return items.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const timeA = a.startTime || '99:99';
        const timeB = b.startTime || '99:99';
        return timeA.localeCompare(timeB);
      });
    },

    async getPendingTasks(referenceDateIso = getTodayISO()) {
      const refDate = parseDateISO(referenceDateIso);
      const pastDate = new Date(refDate);
      pastDate.setDate(pastDate.getDate() - 14);
      const startDate = formatDateISO(pastDate);
      const futureDate = new Date(refDate);
      futureDate.setDate(futureDate.getDate() + 30);
      const endDate = formatDateISO(futureDate);

      const items = await this.queryActivities({ startDate, endDate });
      return filterUntickedTasks(items, referenceDateIso);
    },

    // ------------------------------------
    // HABITS CRUD
    // ------------------------------------
    async createHabit(rawInput) {
      const habit = createHabitModel(rawInput);
      await habitAdapter.save(habit);
      return habit;
    },

    async updateHabit(id, updates) {
      const existing = await habitAdapter.getById(id);
      if (!existing) {
        throw new Error(`ERR_HABIT_NOT_FOUND: Habit ${id} does not exist`);
      }

      const merged = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      validateHabitInput({
        title: merged.title,
        description: merged.description,
        category: merged.category,
        priority: merged.priority,
        recurrence: merged.recurrence,
        timeOfDay: merged.timeOfDay
      });

      await habitAdapter.save(merged);
      return merged;
    },

    async toggleHabitDate(habitId, dateIso) {
      const existing = await habitAdapter.getById(habitId);
      if (!existing) {
        throw new Error(`ERR_HABIT_NOT_FOUND: Habit ${habitId} does not exist`);
      }

      const updated = toggleHabitCompletion(existing, dateIso);
      await habitAdapter.save(updated);
      return {
        habit: updated,
        completed: Boolean(updated.completions && updated.completions[dateIso])
      };
    },

    async deleteHabit(id) {
      return await habitAdapter.remove(id);
    },

    async getHabit(id) {
      return await habitAdapter.getById(id);
    },

    async getAllHabits() {
      return await habitAdapter.getAll();
    },

    // ------------------------------------
    // BACKUP & GOOGLE DRIVE PAYLOAD
    // ------------------------------------
    async exportData() {
      const activities = await actAdapter.getAll();
      const habits = await habitAdapter.getAll();
      const payload = {
        app: 'DayPlanner',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        count: activities.length,
        activities,
        habits
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
      const habits = parsed.habits || [];

      const validActs = [];
      for (const raw of activities) {
        try {
          if (raw.isHabit || raw.id?.startsWith('hab_act_')) continue;
          const validated = validateActivityInput(raw);
          validActs.push({
            id: raw.id || createActivityModel(raw).id,
            ...validated,
            completed: Boolean(raw.completed),
            completedAt: raw.completedAt || null,
            createdAt: raw.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch {}
      }

      const validHabits = [];
      for (const h of habits) {
        try {
          const validated = validateHabitInput(h);
          validHabits.push({
            id: h.id || createHabitModel(h).id,
            ...validated,
            completions: h.completions || {},
            createdAt: h.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch {}
      }

      await actAdapter.bulkSave(validActs);
      if (validHabits.length > 0) {
        await habitAdapter.bulkSave(validHabits);
      }

      return {
        imported: validActs.length + validHabits.length,
        success: true
      };
    }
  };
}
