import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateISO,
  parseDateISO,
  getStartOfWeek,
  getWeekDays,
  getMonthGrid,
  groupActivitiesByDate,
  filterUntickedTasks
} from '../../js/core/calendar-utils.mjs';

test('Calendar Utils: formatDateISO and parseDateISO handle YYYY-MM-DD cleanly', () => {
  const d = new Date(2026, 10, 13); // Nov 13, 2026
  const iso = formatDateISO(d);
  assert.equal(iso, '2026-11-13');

  const parsed = parseDateISO('2026-11-13');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10);
  assert.equal(parsed.getDate(), 13);
});

test('Calendar Utils: getWeekDays returns 7 contiguous days', () => {
  const current = '2026-11-13'; // Friday
  const week = getWeekDays(current, { startOnMonday: true });
  assert.equal(week.length, 7);
  assert.equal(week[0].isoString, '2026-11-09'); // Monday
  assert.equal(week[4].isoString, '2026-11-13'); // Friday
  assert.equal(week[6].isoString, '2026-11-15'); // Sunday
});

test('Calendar Utils: getMonthGrid returns complete calendar matrix with pad days', () => {
  const grid = getMonthGrid(2026, 10); // November 2026
  assert.ok(grid.length >= 35); // 5 or 6 weeks * 7 days
  assert.equal(grid.length % 7, 0);

  const nov13 = grid.find(cell => cell.isoString === '2026-11-13');
  assert.ok(nov13);
  assert.equal(nov13.isCurrentMonth, true);
  assert.equal(nov13.dayNumber, 13);
});

test('Calendar Utils: filterUntickedTasks extracts pending tasks with categorization', () => {
  const sample = [
    { id: '1', title: 'Overdue task', date: '2026-11-10', completed: false, priority: 'P1_URGENT' },
    { id: '2', title: 'Done task', date: '2026-11-12', completed: true, priority: 'P2_HIGH' },
    { id: '3', title: 'Today task', date: '2026-11-13', completed: false, priority: 'P2_HIGH' },
    { id: '4', title: 'Upcoming task', date: '2026-11-15', completed: false, priority: 'P4_LOW' }
  ];

  const pending = filterUntickedTasks(sample, '2026-11-13');
  assert.equal(pending.length, 3);
  assert.equal(pending.find(p => p.id === '2'), undefined);

  const overdue = pending.find(p => p.id === '1');
  assert.equal(overdue.statusCategory, 'OVERDUE');

  const today = pending.find(p => p.id === '3');
  assert.equal(today.statusCategory, 'TODAY');

  const upcoming = pending.find(p => p.id === '4');
  assert.equal(upcoming.statusCategory, 'UPCOMING');
});
