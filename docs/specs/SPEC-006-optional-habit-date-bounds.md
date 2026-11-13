---
id: SPEC-006
title: Optional Start and End Dates for Habits
status: LOCKED
owner_mode: architect
target_platforms: [PWA, Android]
offline_capable: true
invariants:
  - habit_start_date_optional
  - habit_end_date_optional
  - habit_occurrences_bounded_by_dates
  - backwards_compatible_habits_without_bounds
---

# Specification: Optional Start and End Dates for Habits

## 1. Functional Requirements

- **FR-01 (Optional Start Date for Habits)**:
  - Habit model supports an optional `startDate` field (`string` in `YYYY-MM-DD` format or `null`).
  - When specified, no habit occurrences are generated or scheduled on calendar days prior to `startDate` (`date < startDate`).
  - If omitted or empty, `startDate` defaults to `null` (habit has no lower date bound).

- **FR-02 (Optional End Date for Habits)**:
  - Habit model supports an optional `endDate` field (`string` in `YYYY-MM-DD` format or `null`).
  - When specified, no habit occurrences are generated or scheduled on calendar days following `endDate` (`date > endDate`).
  - If omitted or empty, `endDate` defaults to `null` (habit has no upper date bound and recurs indefinitely).

- **FR-03 (Stats, Analytics & Streak Bounding)**:
  - `calculateHabitStats`:
    - History dot matrix, streaks, and 30-day completion rate calculations respect `startDate` and `endDate`.
    - Days before `startDate` or after `endDate` are not marked as target/scheduled days, so missing days outside the active window does not penalize streaks or completion percentage.

- **FR-04 (UI Creation, Editing & Card Display)**:
  - `#habit-modal` provides optional `Start Date` and `End Date` input controls.
  - When editing an existing habit, `startDate` and `endDate` are populated into the form.
  - Habit cards on the Habits view display the active period (e.g. `Nov 1, 2026 – Dec 31, 2026`, `From Nov 1, 2026`, `Until Dec 31, 2026`, or `Ongoing`) if bounds are set.

## 2. Interface Contracts

```typescript
export interface HabitModel {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  timeOfDay: string;
  targetDaysPerWeek: number;
  startDate: string | null; // Optional YYYY-MM-DD
  endDate: string | null;   // Optional YYYY-MM-DD
  recurrence: {
    frequency: 'DAILY' | 'WEEKDAYS' | 'WEEKENDS' | 'WEEKLY' | 'MONTHLY';
    daysOfWeek?: number[];
    dayOfMonth?: number;
    startDate?: string | null;
    endDate?: string | null;
  };
  completions: Record<string, boolean>; // dateIso -> true
  createdAt: string;
  updatedAt: string;
}
```

## 3. Edge Cases & Error Handling

| Scenario | System Behavior |
| :--- | :--- |
| `startDate` is provided, `endDate` is null | Habit occurs on and after `startDate` indefinitely |
| `endDate` is provided, `startDate` is null | Habit occurs up to and including `endDate` |
| Both omitted | Habit occurs without date bounds (backwards compatible) |
| Invalid date format string provided | Handled gracefully and sanitized to `null` |
| `startDate` is after `endDate` | Validation normalizes or swaps bounds to prevent impossible intervals |

