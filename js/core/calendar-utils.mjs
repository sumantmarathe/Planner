/**
 * Calendar and Date Manipulation Utilities
 */

import { PRIORITY_WEIGHTS } from './activity.mjs';

export function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatDateISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = padZero(dateObj.getMonth() + 1);
  const d = padZero(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

export function parseDateISO(isoString) {
  const [y, m, d] = isoString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getTodayISO() {
  return formatDateISO(new Date());
}

/**
 * Returns Monday (or Sunday) start of week date
 */
export function getStartOfWeek(dateOrIso, { startOnMonday = true } = {}) {
  const d = typeof dateOrIso === 'string' ? parseDateISO(dateOrIso) : new Date(dateOrIso);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diff = d.getDate() - day + (startOnMonday ? (day === 0 ? -6 : 1) : 0);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Returns array of 7 day descriptors for a given week
 */
export function getWeekDays(dateOrIso, options = { startOnMonday: true }) {
  const start = getStartOfWeek(dateOrIso, options);
  const days = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    days.push({
      dateObj: cur,
      isoString: formatDateISO(cur),
      dayNumber: cur.getDate(),
      dayNameShort: cur.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNameLong: cur.toLocaleDateString('en-US', { weekday: 'long' }),
      isToday: formatDateISO(cur) === getTodayISO()
    });
  }

  return days;
}

/**
 * Returns complete month grid matrix (includes leading and trailing days)
 */
export function getMonthGrid(year, monthIndex, { startOnMonday = true } = {}) {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

  const startDay = firstDayOfMonth.getDay();
  // Calculate offset to first cell
  let leadingDaysCount = startOnMonday ? (startDay === 0 ? 6 : startDay - 1) : startDay;

  const totalDays = lastDayOfMonth.getDate();
  const grid = [];

  // Previous month padding
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  for (let i = leadingDaysCount - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const dateObj = new Date(year, monthIndex - 1, day);
    grid.push({
      dateObj,
      isoString: formatDateISO(dateObj),
      dayNumber: day,
      isCurrentMonth: false,
      isPrevMonth: true,
      isNextMonth: false,
      isToday: formatDateISO(dateObj) === getTodayISO()
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, monthIndex, d);
    grid.push({
      dateObj,
      isoString: formatDateISO(dateObj),
      dayNumber: d,
      isCurrentMonth: true,
      isPrevMonth: false,
      isNextMonth: false,
      isToday: formatDateISO(dateObj) === getTodayISO()
    });
  }

  // Next month padding to fill multiple of 7
  const remainder = grid.length % 7;
  const trailingDaysCount = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= trailingDaysCount; d++) {
    const dateObj = new Date(year, monthIndex + 1, d);
    grid.push({
      dateObj,
      isoString: formatDateISO(dateObj),
      dayNumber: d,
      isCurrentMonth: false,
      isPrevMonth: false,
      isNextMonth: true,
      isToday: formatDateISO(dateObj) === getTodayISO()
    });
  }

  return grid;
}

/**
 * Group activities by their YYYY-MM-DD date string
 */
export function groupActivitiesByDate(activities) {
  const map = new Map();
  for (const act of activities) {
    if (!map.has(act.date)) {
      map.set(act.date, []);
    }
    map.get(act.date).push(act);
  }
  return map;
}

/**
 * Categorizes and filters unticked (pending) tasks
 */
export function filterUntickedTasks(activities, referenceDateIso = getTodayISO()) {
  const pending = activities.filter(a => !a.completed);

  return pending.map(task => {
    let statusCategory = 'UPCOMING';
    if (task.date < referenceDateIso) {
      statusCategory = 'OVERDUE';
    } else if (task.date === referenceDateIso) {
      statusCategory = 'TODAY';
    }

    return {
      ...task,
      statusCategory
    };
  }).sort((a, b) => {
    // Sort primarily by priority weight (P1 first), secondarily by date
    const weightA = PRIORITY_WEIGHTS[a.priority] || 99;
    const weightB = PRIORITY_WEIGHTS[b.priority] || 99;
    if (weightA !== weightB) return weightA - weightB;
    return a.date.localeCompare(b.date);
  });
}

