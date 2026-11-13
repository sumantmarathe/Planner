---
id: SPEC-001
title: Premium Dual-Target Day Planner & Calendar
status: LOCKED
owner_mode: architect
target_platforms: [PWA, Android]
offline_capable: true
invariants:
  - zero_data_loss
  - local_first_persistence
  - strict_priority_enforcement
  - dual_target_parity
---

# Specification: Premium Dual-Target Day Planner & Calendar

## 1. Functional Requirements

- **FR-01 (Activity Data Model)**: Each activity must have a unique identifier, title, optional description, date (`YYYY-MM-DD`), optional start/end time (`HH:mm`), priority (`P1_URGENT`, `P2_HIGH`, `P3_MEDIUM`, `P4_LOW`), tag/category, completed boolean flag, completedAt ISO timestamp, and audit timestamps (`createdAt`, `updatedAt`).
- **FR-02 (Local-First Persistence & Offline-First)**: Data is stored in client-side storage (`IndexedDB` with fallback to `localStorage`), operational 100% offline. Zero server requirement. Complete backup export & import in JSON.
- **FR-03 (Calendar Day, Week, Month Views)**:
  - **Day View**: Chronological / time-blocked breakdown of activities scheduled for the selected date, quick add at specific hours, completed indicator.
  - **Week View**: 7-day columns (Monday to Sunday or Sunday to Saturday), showing scheduled items per day with priority color coding and completion checkboxes.
  - **Month View**: Standard 7x5 or 7x6 month grid showing date numbers, dots/badges for scheduled activities colored by priority, and summary count of pending vs completed items.
- **FR-04 (Tasks / Backlog View)**:
  - Dedicated view showing all unticked (pending) activities across all dates.
  - Segmentation: Overdue, Today, Upcoming, and Unscheduled/General.
  - Sortable by: Priority (P1 -> P4), Date (asc/desc), Title.
  - Filterable by: Priority, Category, Search query.
- **FR-05 (Completion & Checkmark Mechanics)**:
  - Toggling checkmark marks activity as completed (`completed: true`, `completedAt: ISO string`).
  - Completed items visually reflect status (strikethrough, muted accent) in calendar views and are archived from the active Tasks backlog.
  - Reversible toggle (unchecking clears `completedAt` and restores active task state).
- **FR-06 (Dual-Target Deployment Parity)**:
  - **PC / GitHub Pages**: Static HTML5/CSS3/ES-modules with relative paths (`./`), responsive widescreen layout, web app manifest, and offline service worker.
  - **Android (Google Play Console)**: PWA-compliant asset manifest, Android Capacitor config (`capacitor.config.json`), touch-optimized UI, high-res adaptive icon assets, and automated build/package script.
- **FR-07 (Premium Aesthetic & Ergonomics)**:
  - Refined modern dark theme with subtle glassmorphism, crisp typography, clean micro-interactions, keyboard shortcuts (e.g., `N` for new activity, `1-4` for views, `Esc` to close modal).

## 2. Interface Contracts

```typescript
export type PriorityLevel = 'P1_URGENT' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';

export interface Activity {
  id: string;                      // UUID or nanoid
  title: string;                   // Min 1 char, trimmed
  description?: string;            // Markdown or plain text
  date: string;                    // YYYY-MM-DD format
  startTime?: string | null;       // HH:mm (24h)
  endTime?: string | null;         // HH:mm (24h)
  priority: PriorityLevel;         // Default: P3_MEDIUM
  category?: string;               // e.g., 'Work', 'Health', 'Personal'
  completed: boolean;              // Default: false
  completedAt?: string | null;     // ISO8601 string
  createdAt: string;               // ISO8601 string
  updatedAt: string;               // ISO8601 string
}

export interface ActivityFilterOptions {
  date?: string;
  startDate?: string;
  endDate?: string;
  priority?: PriorityLevel;
  completed?: boolean;
  category?: string;
  searchQuery?: string;
}

export interface PlannerStore {
  createActivity(input: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'>): Promise<Activity>;
  updateActivity(id: string, updates: Partial<Activity>): Promise<Activity>;
  toggleActivity(id: string): Promise<Activity>;
  deleteActivity(id: string): Promise<boolean>;
  getActivity(id: string): Promise<Activity | null>;
  queryActivities(options?: ActivityFilterOptions): Promise<Activity[]>;
  getPendingTasks(): Promise<Activity[]>;
  exportData(): Promise<string>;
  importData(jsonString: string): Promise<{ imported: number; success: boolean }>;
}
```

## 3. Boundary & Error Conditions

| Condition | Expected Behavior | Error Code / Handling |
| :--- | :--- | :--- |
| Missing or empty title | Throw validation error; reject creation/update | `ERR_VALIDATION_TITLE` |
| Invalid date format | Enforce strict `YYYY-MM-DD` regex or reject | `ERR_VALIDATION_DATE` |
| Invalid priority string | Fallback to `P3_MEDIUM` or reject invalid enum | `ERR_VALIDATION_PRIORITY` |
| Corrupt or invalid JSON import | Abort transaction, preserve existing database intact | `ERR_IMPORT_CORRUPT` |
| Storage quota exceeded | Notify user, provide instant JSON export link | `ERR_STORAGE_QUOTA` |
| Offline network state | Application continues operating without network warning | `OFFLINE_NORMAL` |
