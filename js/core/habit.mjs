/**
 * Habit Tracking & Recurrence Engine
 */

import { PRIORITIES } from './activity.mjs';
import { formatDateISO, parseDateISO, getTodayISO } from './calendar-utils.mjs';

export const RECURRENCE_FREQUENCIES = Object.freeze({
  DAILY: 'DAILY',
  WEEKDAYS: 'WEEKDAYS',
  WEEKENDS: 'WEEKENDS',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY'
});

export const RECURRENCE_LABELS = Object.freeze({
  DAILY: 'Every Day',
  WEEKDAYS: 'Weekdays (Mon-Fri)',
  WEEKENDS: 'Weekends (Sat-Sun)',
  WEEKLY: 'Specific Days',
  MONTHLY: 'Monthly'
});

export const HABIT_CATEGORIES = Object.freeze([
  'Health',
  'Fitness',
  'Mindfulness',
  'Productivity',
  'Learning',
  'Personal',
  'Finance'
]);

/**
 * Checks whether a given ISO date (YYYY-MM-DD) matches the recurrence rule
 */
export function isDateScheduledByRule(dateIso, rule = {}) {
  if (!rule || !rule.frequency) return true;

  if (rule.startDate && dateIso < rule.startDate) {
    return false;
  }

  if (rule.endDate && dateIso > rule.endDate) {
    return false;
  }

  const dateObj = parseDateISO(dateIso);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  switch (rule.frequency) {
    case RECURRENCE_FREQUENCIES.DAILY:
      return true;

    case RECURRENCE_FREQUENCIES.WEEKDAYS:
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case RECURRENCE_FREQUENCIES.WEEKENDS:
      return dayOfWeek === 0 || dayOfWeek === 6;

    case RECURRENCE_FREQUENCIES.WEEKLY:
      if (Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0) {
        return rule.daysOfWeek.includes(dayOfWeek);
      }
      return true;

    case RECURRENCE_FREQUENCIES.MONTHLY: {
      const targetDayOfMonth = rule.dayOfMonth || 1;
      return dateObj.getDate() === targetDayOfMonth;
    }

    default:
      return true;
  }
}

/**
 * Generates array of scheduled ISO date strings between start and end date
 */
export function generateOccurrences(startDateIso, endDateIso, rule) {
  const dates = [];
  const start = parseDateISO(startDateIso);
  const end = parseDateISO(endDateIso);

  const cur = new Date(start);
  while (cur <= end) {
    const curIso = formatDateISO(cur);
    if (isDateScheduledByRule(curIso, rule)) {
      dates.push(curIso);
    }
    cur.setDate(cur.getDate() + 1);
  }

  return dates;
}

/**
 * Generate unique ID
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'hab_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Validates raw habit inputs
 */
export function validateHabitInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('ERR_VALIDATION_INPUT: Input must be an object');
  }

  const title = (input.title || '').trim();
  if (!title) {
    throw new Error('ERR_VALIDATION_TITLE: Title is required for habit');
  }

  let priority = input.priority;
  if (!priority || !Object.values(PRIORITIES).includes(priority)) {
    priority = PRIORITIES.P3_MEDIUM;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  let startDate = (input.startDate || '').trim() || null;
  let endDate = (input.endDate || '').trim() || null;

  if (startDate && (!dateRegex.test(startDate) || isNaN(Date.parse(startDate)))) {
    startDate = null;
  }
  if (endDate && (!dateRegex.test(endDate) || isNaN(Date.parse(endDate)))) {
    endDate = null;
  }

  // If both provided and startDate > endDate, swap to keep valid range
  if (startDate && endDate && startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  const rawRecurrence = input.recurrence || {};
  const recurrence = {
    frequency: RECURRENCE_FREQUENCIES.DAILY,
    ...rawRecurrence,
    startDate: startDate || rawRecurrence.startDate || null,
    endDate: endDate || rawRecurrence.endDate || null
  };
  if (!Object.values(RECURRENCE_FREQUENCIES).includes(recurrence.frequency)) {
    recurrence.frequency = RECURRENCE_FREQUENCIES.DAILY;
  }

  return {
    title,
    description: (input.description || '').trim(),
    category: (input.category || 'Health').trim() || 'Health',
    priority,
    startDate,
    endDate,
    recurrence,
    timeOfDay: input.timeOfDay || 'anytime',
    targetDaysPerWeek: input.targetDaysPerWeek || 7
  };
}

/**
 * Habit entity factory
 */
export function createHabitModel(rawInput) {
  const validated = validateHabitInput(rawInput);
  const now = new Date().toISOString();

  return {
    id: rawInput.id || generateId(),
    ...validated,
    completions: rawInput.completions && typeof rawInput.completions === 'object' ? { ...rawInput.completions } : {},
    createdAt: rawInput.createdAt || now,
    updatedAt: now
  };
}

/**
 * Toggle habit completion state for a given date
 */
export function toggleHabitCompletion(habit, dateIso) {
  if (!habit || typeof habit !== 'object') {
    throw new Error('ERR_INVALID_HABIT: Expected habit object');
  }

  const completions = { ...(habit.completions || {}) };
  if (completions[dateIso]) {
    delete completions[dateIso];
  } else {
    completions[dateIso] = true;
  }

  return {
    ...habit,
    completions,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Calculate streak and consistency analytics for a habit
 */
export function calculateHabitStats(habit, referenceDateIso = getTodayISO()) {
  const completions = habit.completions || {};
  const totalCompletions = Object.keys(completions).length;

  // 1. Current streak calculation
  let currentStreak = 0;
  const refDate = parseDateISO(referenceDateIso);

  // Check if today is scheduled and completed
  let checkDate = new Date(refDate);
  const todayIso = formatDateISO(checkDate);
  const isTodayScheduled = isDateScheduledByRule(todayIso, habit.recurrence);
  const isTodayCompleted = Boolean(completions[todayIso]);

  // If today is scheduled and completed, start from today.
  // If today is scheduled but not yet completed, start checking backwards from yesterday so streak isn't prematurely lost mid-day.
  if (isTodayScheduled && !isTodayCompleted) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count backwards consecutive scheduled days completed
  for (let i = 0; i < 365; i++) {
    const dIso = formatDateISO(checkDate);
    const scheduled = isDateScheduledByRule(dIso, habit.recurrence);

    if (scheduled) {
      if (completions[dIso]) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // 2. Best streak calculation (traverse all completed dates)
  let bestStreak = currentStreak;
  const sortedDates = Object.keys(completions).sort();
  if (sortedDates.length > 0) {
    let tempStreak = 0;
    const firstDate = parseDateISO(sortedDates[0]);
    const lastDate = parseDateISO(sortedDates[sortedDates.length - 1]);
    const sweep = new Date(firstDate);

    while (sweep <= lastDate) {
      const sIso = formatDateISO(sweep);
      if (isDateScheduledByRule(sIso, habit.recurrence)) {
        if (completions[sIso]) {
          tempStreak++;
          if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
          tempStreak = 0;
        }
      }
      sweep.setDate(sweep.getDate() + 1);
    }
  }

  // 3. Last 14 days history matrix (for mini heatmaps)
  const historyLast14d = [];
  const histSweep = new Date(refDate);
  histSweep.setDate(histSweep.getDate() - 13); // 14 days total including today

  for (let i = 0; i < 14; i++) {
    const hIso = formatDateISO(histSweep);
    historyLast14d.push({
      date: hIso,
      dayNumber: histSweep.getDate(),
      dayNameShort: histSweep.toLocaleDateString('en-US', { weekday: 'narrow' }),
      isTargetDay: isDateScheduledByRule(hIso, habit.recurrence),
      completed: Boolean(completions[hIso]),
      isToday: hIso === referenceDateIso
    });
    histSweep.setDate(histSweep.getDate() + 1);
  }

  // 4. Last 30 days completion rate
  const rateSweep = new Date(refDate);
  rateSweep.setDate(rateSweep.getDate() - 29);
  let scheduled30d = 0;
  let completed30d = 0;

  for (let i = 0; i < 30; i++) {
    const rIso = formatDateISO(rateSweep);
    if (isDateScheduledByRule(rIso, habit.recurrence)) {
      scheduled30d++;
      if (completions[rIso]) completed30d++;
    }
    rateSweep.setDate(rateSweep.getDate() + 1);
  }

  const completionRate30d = scheduled30d > 0 ? Math.round((completed30d / scheduled30d) * 100) : 0;

  return {
    currentStreak,
    bestStreak,
    totalCompletions,
    completionRate30d,
    historyLast14d
  };
}

