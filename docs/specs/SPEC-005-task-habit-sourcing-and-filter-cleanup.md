---
id: SPEC-005
title: Planner Sourcing from Tasks & Habits and Filter Bar Cleanup
status: LOCKED
owner_mode: architect
target_platforms: [PWA, Android]
offline_capable: true
invariants:
  - planner_no_direct_activity_creation
  - tasks_created_in_tasks_tab
  - habits_created_in_habits_tab
  - planner_fetches_tasks_and_habits
  - non_functional_category_dropdown_removed
---

# Specification: Planner Sourcing from Tasks & Habits and Filter Bar Cleanup

## 1. Functional Requirements

- **FR-01 (Remove Direct "Plan Activity" from Planner & Header)**:
  - Remove the global `#btn-new-activity` ("Plan Activity") button from the app header.
  - The Planner (`Plan` tab) no longer directly creates unanchored generic "activities".
  - Activities in DayPlanner strictly originate as either **Tasks** or **Habits**.

- **FR-02 (Task Authoring in Tasks Tab)**:
  - The **Tasks** tab (`#view-tasks`) features a dedicated header action: `[+ Add Task]` (`#btn-new-task`).
  - Clicking `[+ Add Task]` opens the Task modal allowing users to create or edit tasks with: Title, Date (optional/scheduled), Time slot (optional), Priority (P1-P4), and Description.
  - Keyboard shortcut <kbd>N</kbd> when on the Tasks tab (or globally) creates a Task in the Tasks tab.

- **FR-03 (Planner Automatically Fetches Tasks & Habits)**:
  - The Planner (Day, Week, Month calendar views) automatically fetches and displays:
    1. Tasks scheduled for the given timeframe from the Tasks store (including active/overdue unticked tasks when viewing Today).
    2. Habits scheduled for the given timeframe expanded by recurrence rules from the Habits store.
  - Sourcing is 100% automatic: no manual "Fetch" buttons, dialogs, or intermediate modals are required.
  - If a day has no scheduled tasks or habits, the empty state displays clean navigation links to manage tasks in the Tasks tab or habits in the Habits tab.

- **FR-04 (Filter Bar Cleanup - Remove Non-Functional "General" Dropdown)**:
  - Remove the non-functional `<select id="category-filter">` which defaulted to "General" and did nothing useful.
  - In its place, provide an Item Type filter:
    - `<select id="type-filter">` with options:
      - `All Items` (default: shows both tasks and habits)
      - `Tasks Only` (filters to standalone tasks)
      - `Habits Only` (filters to recurring habits)
  - Retain the Search input and Priority filter (P1-P4).

## 2. Interface Contracts

```typescript
export interface TaskScheduleInput {
  taskId: string;
  targetDate: string; // YYYY-MM-DD
  startTime?: string | null;
  endTime?: string | null;
}

export interface PlannerStoreExtensions {
  scheduleTaskForDate(taskId: string, targetDate: string, timeSlot?: { startTime?: string, endTime?: string }): Promise<ActivityRecord>;
}
```

## 3. Edge Cases & Error Handling

| Scenario | System Behavior | Error/Event Code |
| :--- | :--- | :--- |
| User tries to "Fetch from Tasks" when backlog is empty | Display clean empty state with button to go to Tasks tab to create one | `UI_FETCH_NO_PENDING_TASKS` |
| User schedules backlog task for today | Task `date` updated to selected date, immediately re-renders on Day view | `TASK_SCHEDULED_FOR_DATE` |
| Filter by "Habits Only" on Day view | Only habit occurrences for that day are shown | `VIEW_FILTER_APPLIED` |

