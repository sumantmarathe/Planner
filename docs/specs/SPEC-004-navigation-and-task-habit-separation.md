---
id: SPEC-004
title: Hierarchical Navigation (Plan / Tasks / Habits) & Task-Habit Domain Separation
status: LOCKED
owner_mode: architect
target_platforms: [PWA, Android]
offline_capable: true
invariants:
  - habits_excluded_from_task_backlog
  - unified_plan_calendar_views
  - zero_data_loss
  - local_first_persistence
---

# Specification: Hierarchical Navigation & Task-Habit Separation

## 1. Functional Requirements

- **FR-01 (Primary Navigation Hierarchy)**:
  - Top navigation bar simplified to 3 primary tabs:
    1. **Plan**: Calendar planning hub. Contains sub-view toggles for **Day**, **Week**, and **Month**.
    2. **Tasks**: Dedicated task management backlog (uncompleted action items).
    3. **Habits**: Dedicated habit building and routine tracking hub (streaks, heatmap).
  - Keyboard shortcuts:
    - <kbd>P</kbd> or <kbd>1</kbd>: Switch to **Plan**
    - <kbd>T</kbd> or <kbd>2</kbd>: Switch to **Tasks**
    - <kbd>H</kbd> or <kbd>3</kbd>: Switch to **Habits**
    - When inside Plan: <kbd>D</kbd> (Day), <kbd>W</kbd> (Week), <kbd>M</kbd> (Month).

- **FR-02 (Plan Sub-Navigation Switcher)**:
  - Inside the Plan section (in the controls bar), a segmented pill switcher allows instant switching between:
    - `Day` (Hourly timeline + daily checklist)
    - `Week` (7-day multi-column schedule)
    - `Month` (Full monthly date matrix)
  - Active sub-view is remembered across navigation switches.

- **FR-03 (Task vs. Habit Domain Separation)**:
  - Activities are categorized as either **Tasks** or **Habits**.
  - **Tasks View (`#view-tasks`)**:
    - Strictly displays non-habit pending tasks (`isHabit !== true`).
    - Habits are explicitly **excluded** from the Tasks backlog.
  - **Plan Views (`#view-plan`)**:
    - Displays both tasks and scheduled habit occurrences so the user can see their full day/week/month schedule.
    - Habit occurrences on the calendar are distinctly badged with `🌱 Habit`.
  - **Habits View (`#view-habits`)**:
    - Dedicated habit cards, 1-tap today actions, streak flames (`🔥`), personal bests (`🏆`), and 14-day consistency heatmaps.

## 2. Interface Contracts

```typescript
export type PrimaryView = 'plan' | 'tasks' | 'habits';
export type PlanSubView = 'day' | 'week' | 'month';

export interface PlannerStore {
  // getPendingTasks returns strictly tasks (habits excluded)
  getPendingTasks(referenceDateIso?: string): Promise<Activity[]>;
  // queryActivities can filter by includeHabits boolean (default true for calendar)
  queryActivities(options?: ActivityFilterOptions & { includeHabits?: boolean }): Promise<Activity[]>;
}
```

## 3. Boundary & Error Conditions

| Condition | Expected Behavior | Error Code / Handling |
| :--- | :--- | :--- |
| Querying Tasks backlog | Filter out any item where `isHabit === true` or `habitId` is present | `FILTER_NO_HABIT_IN_TASKS` |
| Switching to Plan tab | Restores last active sub-view (`day`, `week`, or `month`) | `PLAN_SUBVIEW_RESTORED` |
| Toggling habit on Plan calendar | Toggles date in habit record, preserves task backlog intact | `HABIT_DATE_TOGGLED` |

