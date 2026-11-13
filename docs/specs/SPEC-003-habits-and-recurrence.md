---
id: SPEC-003
title: Habits Tracking System & Flexible Activity Recurrence Engine
status: LOCKED
owner_mode: architect
target_platforms: [PWA, Android]
offline_capable: true
invariants:
  - streak_calculation_integrity
  - recurrence_date_determinism
  - bidirectional_calendar_sync
  - local_first_persistence
---

# Specification: Habits Tracking System & Flexible Activity Recurrence Engine

## 1. Functional Requirements

- **FR-01 (Flexible Recurrence Engine)**:
  - Supported recurrence patterns:
    - `DAILY`: Every day or every `n` days.
    - `WEEKDAYS`: Monday through Friday.
    - `WEEKENDS`: Saturday and Sunday.
    - `WEEKLY`: Configurable on specific days (e.g., `['MON', 'WED', 'FRI']`).
    - `MONTHLY`: Specific day of month (e.g., 1st or 15th).
  - Recurrence rule object:
    `{ frequency: RecurrenceFreq, interval?: number, daysOfWeek?: number[], endDate?: string }`.
  - Occurrence generation: Pure deterministic expansion of dates within a window `[startDate, endDate]`.

- **FR-02 (Habit Data Model)**:
  - `id`: string (UUID).
  - `title`: string (min 1 char).
  - `description`: string optional.
  - `category`: string (e.g. 'Health', 'Fitness', 'Mindfulness', 'Productivity', 'Learning').
  - `priority`: PriorityLevel (`P1_URGENT`, `P2_HIGH`, `P3_MEDIUM`, `P4_LOW`).
  - `recurrence`: RecurrenceRule.
  - `timeOfDay`: 'morning' | 'afternoon' | 'evening' | 'anytime'.
  - `completions`: Record<string, boolean> (map of `YYYY-MM-DD` -> true).
  - `createdAt`: ISO timestamp.
  - `updatedAt`: ISO timestamp.

- **FR-03 (Streak & Analytics Calculations)**:
  - `currentStreak`: Count of consecutive target scheduled days completed up to today (or yesterday if today is not yet over).
  - `bestStreak`: Maximum consecutive completed streak recorded.
  - `completionRate30d`: Percentage of scheduled occurrences completed in the last 30 days.
  - `historyLast14d`: Array of 14 boolean states representing the last 14 days for mini heatmaps.

- **FR-04 (Calendar & Task Backlog Bi-Directional Linking)**:
  - Toggling a habit for date `D` automatically updates any matching activity on the Day/Week/Month calendar views for that date.
  - Toggling an activity linked to a habit marks the habit as completed for that date.

- **FR-05 (Dedicated Habits View UI)**:
  - Accessible via top navigation tab "Habits" (Keyboard shortcut <kbd>5</kbd> or <kbd>H</kbd>).
  - Habit Cards with:
    - Current streak flame pill 🔥 and Best streak trophy 🏆.
    - Interactive 1-tap Today checkmark button with celebratory pulse.
    - 14-day visual dot matrix / mini-heatmap showing consistency.
    - Category pills with filtering bar.
    - Category breakdown / momentum summary stats at top of page.
  - "New Habit" modal with rich recurrence presets.

## 2. Interface Contracts

```typescript
export type RecurrenceFreq = 'DAILY' | 'WEEKDAYS' | 'WEEKENDS' | 'WEEKLY' | 'MONTHLY';

export interface RecurrenceRule {
  frequency: RecurrenceFreq;
  interval?: number;         // e.g. every 2 weeks
  daysOfWeek?: number[];     // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  endDate?: string | null;   // YYYY-MM-DD
}

export interface Habit {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: PriorityLevel;
  recurrence: RecurrenceRule;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  targetDaysPerWeek?: number;
  completions: Record<string, boolean>; // key: YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  completionRate30d: number;
  historyLast14d: { date: string; completed: boolean; isTargetDay: boolean }[];
}

export interface HabitStore {
  createHabit(input: Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'completions'>): Promise<Habit>;
  updateHabit(id: string, updates: Partial<Habit>): Promise<Habit>;
  deleteHabit(id: string): Promise<boolean>;
  toggleHabitDate(habitId: string, dateIso: string): Promise<{ habit: Habit; completed: boolean }>;
  getAllHabits(): Promise<Habit[]>;
  getHabitStats(habitId: string, referenceDateIso?: string): Promise<HabitStats>;
}
```

## 3. Boundary & Error Conditions

| Condition | Expected Behavior | Error Code / Handling |
| :--- | :--- | :--- |
| Missing habit title | Reject with validation error | `ERR_VALIDATION_TITLE` |
| Invalid recurrence frequency | Fallback to `DAILY` | `ERR_VALIDATION_RECURRENCE` |
| Streak calculation spanning months | Correctly account for calendar days and scheduled days | `STREAK_CALCULATED` |
| Habit toggled offline | Update local state, queue for Google Drive sync | `OFFLINE_SYNC_QUEUED` |

