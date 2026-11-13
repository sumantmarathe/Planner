/**
 * DayPlanner Application UI Controller with Confidential Google Drive Sync & Habits
 */

import { PRIORITIES, PRIORITY_LABELS } from '../core/activity.mjs';
import {
  formatDateISO,
  parseDateISO,
  getTodayISO,
  getWeekDays,
  getMonthGrid,
  filterUntickedTasks
} from '../core/calendar-utils.mjs';
import { createPlannerStore } from '../core/store.mjs';
import { GoogleDriveSyncEngine } from '../core/gdrive-sync.mjs';
import { APP_CONFIG } from '../config.mjs';
import {
  calculateHabitStats,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_LABELS,
  HABIT_CATEGORIES
} from '../core/habit.mjs';
import { formatRupees, FINANCE_TYPES, PERIODICITIES } from '../core/finance.mjs';
import {
  generateCashFlowBarChartSvg,
  generateSavingsTrajectorySvg,
  generateCategoryDonutSvg
} from './finance-charts.mjs';

export class DayPlannerApp {
  constructor() {
    this.store = createPlannerStore();
    this.gdrive = new GoogleDriveSyncEngine();
    this.syncTimeout = null;

    this.currentPrimaryView = 'plan'; // 'plan' | 'tasks' | 'habits' | 'finance'
    this.currentPlanSubView = 'day'; // 'day' | 'week' | 'month'
    this.currentView = 'day'; // 'day' | 'week' | 'month' | 'tasks' | 'habits' | 'finance'
    this.selectedDate = getTodayISO();
    this.searchQuery = '';
    this.selectedPriorityFilter = '';
    this.selectedTypeFilter = ''; // '' | 'task' | 'habit'
    this.selectedHabitCategory = 'ALL';
    this.editingActivityId = null;
    this.editingHabitId = null;

    this.financeHorizonMonths = 6;
    this.selectedFinanceFilter = 'ALL';
    this.editingFinanceId = null;

    this.cacheElements();
    this.bindEvents();
    this.initPWA();
    this.initGDrive();
  }

  cacheElements() {
    this.navBtns = document.querySelectorAll('.view-nav-btn');
    this.planSubnav = document.getElementById('plan-subnav');
    this.planSubnavBtns = document.querySelectorAll('.plan-subnav-btn');
    this.controlsBar = document.querySelector('.controls-bar');
    this.viewPanels = {
      day: document.getElementById('view-day'),
      week: document.getElementById('view-week'),
      month: document.getElementById('view-month'),
      tasks: document.getElementById('view-tasks'),
      habits: document.getElementById('view-habits'),
      finance: document.getElementById('view-finance')
    };

    this.pendingBadge = document.getElementById('tasks-pending-badge');
    this.currentDateHeading = document.getElementById('current-date-heading');
    this.prevBtn = document.getElementById('btn-prev');
    this.nextBtn = document.getElementById('btn-next');
    this.todayBtn = document.getElementById('btn-today');

    this.searchInput = document.getElementById('search-input');
    this.priorityFilter = document.getElementById('priority-filter');
    this.typeFilter = document.getElementById('type-filter');

    // Day & Task Elements
    this.dayScheduleCount = document.getElementById('day-schedule-count');
    this.btnNewTask = document.getElementById('btn-new-task');

    // Modals
    this.activityModal = document.getElementById('activity-modal');
    this.activityForm = document.getElementById('activity-form');
    this.modalTitle = document.getElementById('modal-title');
    this.backupModal = document.getElementById('backup-modal');
    this.gdriveModal = document.getElementById('gdrive-modal');

    // Habit Elements
    this.habitsGrid = document.getElementById('habits-grid');
    this.statActiveHabits = document.getElementById('stat-active-habits');
    this.statCompletedToday = document.getElementById('stat-completed-today');
    this.statLongestStreak = document.getElementById('stat-longest-streak');
    this.habitCategoryFilters = document.getElementById('habit-category-filters');
    this.btnNewHabit = document.getElementById('btn-new-habit');
    this.habitModal = document.getElementById('habit-modal');
    this.habitForm = document.getElementById('habit-form');
    this.habitModalTitle = document.getElementById('habit-modal-title');
    this.habitRecurrenceSelect = document.getElementById('form-habit-recurrence');
    this.habitDaysGroup = document.getElementById('habit-days-group');

    // Finance Elements
    this.kpiProjectedSavings = document.getElementById('kpi-projected-savings');
    this.kpiSavingsHorizon = document.getElementById('kpi-savings-horizon');
    this.kpiAvgIncome = document.getElementById('kpi-avg-income');
    this.kpiAvgExpense = document.getElementById('kpi-avg-expense');
    this.kpiSavingsRate = document.getElementById('kpi-savings-rate');
    this.kpiRateSubtext = document.getElementById('kpi-rate-subtext');

    this.chartCashflowContainer = document.getElementById('chart-cashflow-container');
    this.chartSavingsContainer = document.getElementById('chart-savings-container');
    this.chartCategoriesContainer = document.getElementById('chart-categories-container');
    this.financeForecastTableContainer = document.getElementById('finance-forecast-table-container');
    this.financeRecordsContainer = document.getElementById('finance-records-container');

    this.financeHorizonPills = document.querySelectorAll('.horizon-pill-btn');
    this.financeRecordFilterPills = document.querySelectorAll('#finance-record-filter-pills .filter-pill');
    this.btnNewFinance = document.getElementById('btn-new-finance');

    this.financeModal = document.getElementById('finance-modal');
    this.financeForm = document.getElementById('finance-form');
    this.financeModalTitle = document.getElementById('finance-modal-title');
    this.financePeriodicitySelect = document.getElementById('form-finance-periodicity');
    this.financeCustomIntervalGroup = document.getElementById('finance-custom-interval-group');

    // Google Drive Elements
    this.syncPill = document.getElementById('btn-sync-status');
    this.syncLabel = document.getElementById('sync-status-label');
    this.userBadge = document.getElementById('user-profile-badge');
    this.userAvatar = document.getElementById('user-avatar');
    this.userName = document.getElementById('user-name');
    this.signOutBtn = document.getElementById('btn-sign-out');

    this.gdriveClientIdInput = document.getElementById('gdrive-client-id');
    this.gdriveLoginBtn = document.getElementById('btn-gdrive-login');
    this.gdriveSignOutBtn = document.getElementById('btn-gdrive-signout');
    this.gdriveSyncNowBtn = document.getElementById('btn-gdrive-sync-now');
    this.gdriveUnauthView = document.getElementById('gdrive-unauth-view');
    this.gdriveAuthView = document.getElementById('gdrive-auth-view');
    this.gdriveUserDisplay = document.getElementById('gdrive-user-display');
    this.gdriveEmailDisplay = document.getElementById('gdrive-email-display');
    this.gdriveLastSyncTime = document.getElementById('gdrive-last-sync-time');

    // Toast Container
    this.toastContainer = document.getElementById('toast-container');
  }

  bindEvents() {
    // View Switcher (Plan, Tasks, Habits)
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
      });
    });

    // Plan Sub-Navigation (Day, Week, Month)
    this.planSubnavBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        const subview = btn.dataset.subview;
        this.switchPlanSubView(subview);
      });
    });

    // Date Navigation
    this.prevBtn.addEventListener('click', () => this.navigateDate(-1));
    this.nextBtn.addEventListener('click', () => this.navigateDate(1));
    this.todayBtn.addEventListener('click', () => {
      this.selectedDate = getTodayISO();
      this.render();
    });

    // Filters
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.render();
    });

    this.priorityFilter?.addEventListener('change', (e) => {
      this.selectedPriorityFilter = e.target.value;
      this.render();
    });

    this.typeFilter?.addEventListener('change', (e) => {
      this.selectedTypeFilter = e.target.value;
      this.render();
    });

    // Task Actions
    this.btnNewTask?.addEventListener('click', () => {
      this.openActivityModal({ date: this.selectedDate });
    });

    // Open Add Habit Modal
    this.btnNewHabit?.addEventListener('click', () => {
      this.openHabitModal();
    });

    // Habit Recurrence frequency toggle
    this.habitRecurrenceSelect?.addEventListener('change', (e) => {
      if (this.habitDaysGroup) {
        this.habitDaysGroup.style.display = e.target.value === 'WEEKLY' ? 'block' : 'none';
      }
    });

    // Habit Form Submit
    this.habitForm?.addEventListener('submit', (e) => this.handleHabitSubmit(e));

    // Finance Horizon Selector
    this.financeHorizonPills?.forEach(pill => {
      pill.addEventListener('click', () => {
        this.financeHorizonPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.financeHorizonMonths = parseInt(pill.dataset.horizon, 10) || 6;
        if (this.currentView === 'finance') this.renderFinanceView();
      });
    });

    // Finance Records Category / Type Filter
    this.financeRecordFilterPills?.forEach(pill => {
      pill.addEventListener('click', () => {
        this.financeRecordFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedFinanceFilter = pill.dataset.filter || 'ALL';
        if (this.currentView === 'finance') this.renderFinanceView();
      });
    });

    // Finance Add Cash Flow Button
    this.btnNewFinance?.addEventListener('click', () => {
      this.openFinanceModal();
    });

    // Finance Periodicity toggle for custom intervals
    this.financePeriodicitySelect?.addEventListener('change', (e) => {
      if (this.financeCustomIntervalGroup) {
        this.financeCustomIntervalGroup.style.display = e.target.value === 'CUSTOM' ? 'block' : 'none';
      }
    });

    // Finance Form Submit
    this.financeForm?.addEventListener('submit', (e) => this.handleFinanceSubmit(e));

    // Modal Close
    document.querySelectorAll('.modal-close-trigger').forEach(el => {
      el.addEventListener('click', () => {
        this.closeModals();
      });
    });

    // Activity Form Submit
    this.activityForm.addEventListener('submit', (e) => this.handleActivitySubmit(e));

    // Backup & Restore
    document.getElementById('btn-backup-open').addEventListener('click', () => {
      this.openBackupModal();
    });
    document.getElementById('btn-export-data').addEventListener('click', () => this.handleExportData());
    document.getElementById('btn-import-data').addEventListener('click', () => this.handleImportData());

    // Google Drive Sync Controls
    this.syncPill.addEventListener('click', () => this.openGDriveModal());
    this.gdriveLoginBtn.addEventListener('click', () => this.handleGDriveLogin());
    this.gdriveSignOutBtn?.addEventListener('click', () => this.handleGDriveSignOut());
    this.signOutBtn?.addEventListener('click', () => this.handleGDriveSignOut());
    this.gdriveSyncNowBtn?.addEventListener('click', () => this.syncWithGoogleDrive(true));

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') this.closeModals();
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.openActivityModal();
      } else if (e.key.toLowerCase() === 'p' || e.key === '1') {
        e.preventDefault();
        this.switchView('plan');
      } else if (e.key.toLowerCase() === 't' || e.key === '2') {
        e.preventDefault();
        this.switchView('tasks');
      } else if (e.key.toLowerCase() === 'h' || e.key === '3') {
        e.preventDefault();
        this.switchView('habits');
      } else if (e.key.toLowerCase() === 'f' || e.key === '4') {
        e.preventDefault();
        this.switchView('finance');
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.switchPlanSubView('day');
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        this.switchPlanSubView('week');
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        this.switchPlanSubView('month');
      } else if (e.key === 'Escape') {
        this.closeModals();
      }
    });
  }

  async initPWA() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (err) {
        console.warn('ServiceWorker registration skipped:', err);
      }
    }
  }

  initGDrive() {
    if (this.gdriveClientIdInput) {
      this.gdriveClientIdInput.value = this.gdrive.getClientId() || APP_CONFIG.GOOGLE_CLIENT_ID;
    }

    this.gdrive.onStatusChange((status, profile) => {
      this.updateGDriveUI(status, profile);
    });

    this.updateGDriveUI(this.gdrive.status, this.gdrive.getProfile());

    if (this.gdrive.isAuthenticated()) {
      this.syncWithGoogleDrive(false);
    }
  }

  updateGDriveUI(status, profile) {
    if (!this.syncPill) return;

    this.syncPill.className = 'sync-status-pill';

    if (status.state === 'SYNCED') {
      this.syncPill.classList.add('synced');
      this.syncLabel.textContent = status.lastSyncedAt ? `Synced ${status.lastSyncedAt}` : 'Drive Synced';
      if (this.gdriveLastSyncTime) this.gdriveLastSyncTime.textContent = status.lastSyncedAt || 'Just now';
    } else if (status.state === 'SYNCING') {
      this.syncPill.classList.add('syncing');
      this.syncLabel.textContent = 'Syncing...';
    } else if (status.state === 'ERROR') {
      this.syncPill.classList.add('error');
      this.syncLabel.textContent = 'Drive Error';
    } else {
      this.syncPill.classList.add('unauthenticated');
      this.syncLabel.textContent = 'Google Drive';
    }

    const isAuthed = this.gdrive.isAuthenticated();
    if (this.gdriveUnauthView && this.gdriveAuthView) {
      this.gdriveUnauthView.style.display = isAuthed ? 'none' : 'flex';
      this.gdriveAuthView.style.display = isAuthed ? 'flex' : 'none';
    }

    if (isAuthed && profile) {
      if (this.userBadge) this.userBadge.style.display = 'inline-flex';
      if (this.userName) this.userName.textContent = profile.name || profile.email || 'User';
      if (this.userAvatar) {
        if (profile.picture) {
          this.userAvatar.innerHTML = `<img src="${profile.picture}" alt="" style="width:100%;height:100%;border-radius:50%;">`;
        } else {
          this.userAvatar.textContent = (profile.name || 'U')[0].toUpperCase();
        }
      }
      if (this.gdriveUserDisplay) this.gdriveUserDisplay.textContent = profile.name || 'Google Account';
      if (this.gdriveEmailDisplay) this.gdriveEmailDisplay.textContent = profile.email || '';
    } else {
      if (this.userBadge) this.userBadge.style.display = 'none';
    }
  }

  openGDriveModal() {
    this.gdriveModal.classList.add('open');
  }

  async handleGDriveLogin() {
    const clientId = (this.gdriveClientIdInput?.value || '').trim() || APP_CONFIG.GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('Google OAuth Client ID is not configured.');
      return;
    }

    try {
      this.showToast('Connecting to Google...');
      await this.gdrive.requestAccessToken(clientId);
      this.showToast('Connected to Google Drive!');
      await this.syncWithGoogleDrive(true);
    } catch (e) {
      alert(`Google Sign-In Error: ${e.message}`);
    }
  }

  handleGDriveSignOut() {
    this.gdrive.signOut();
    this.showToast('Signed out of Google Drive');
  }

  async syncWithGoogleDrive(manual = false) {
    if (!this.gdrive.isAuthenticated()) {
      if (manual) this.openGDriveModal();
      return;
    }

    try {
      const rawExport = await this.store.exportData();
      const parsedExport = JSON.parse(rawExport);

      const result = await this.gdrive.syncNow({
        activities: parsedExport.activities || [],
        habits: parsedExport.habits || [],
        financeRecords: parsedExport.financeRecords || []
      });

      if (result.merged) {
        await this.store.importData(JSON.stringify(result.merged));
      }

      if (manual) this.showToast('Google Drive sync complete!');
      await this.render();
    } catch (err) {
      console.error('GDrive Sync failed:', err);
      this.showToast(`Sync error: ${err.message}`, true);
    }
  }

  queueGoogleDriveSync() {
    if (!this.gdrive.isAuthenticated()) return;

    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncWithGoogleDrive(false);
    }, 1500);
  }

  switchView(viewName) {
    if (viewName === 'day' || viewName === 'week' || viewName === 'month') {
      this.currentPrimaryView = 'plan';
      this.currentPlanSubView = viewName;
    } else if (viewName === 'plan') {
      this.currentPrimaryView = 'plan';
    } else if (viewName === 'tasks') {
      this.currentPrimaryView = 'tasks';
    } else if (viewName === 'habits') {
      this.currentPrimaryView = 'habits';
    } else if (viewName === 'finance') {
      this.currentPrimaryView = 'finance';
    } else {
      return;
    }

    this.currentView = this.currentPrimaryView === 'plan' ? this.currentPlanSubView : this.currentPrimaryView;

    // Toggle primary view buttons
    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.currentPrimaryView);
    });

    // Toggle plan subnav visibility & active subview
    if (this.planSubnav) {
      if (this.currentPrimaryView === 'plan') {
        this.planSubnav.classList.remove('hidden');
        this.planSubnavBtns?.forEach(btn => {
          const isActive = btn.dataset.subview === this.currentPlanSubView;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      } else {
        this.planSubnav.classList.add('hidden');
      }
    }

    // Toggle controls bar visibility (hidden on finance view)
    if (this.controlsBar) {
      this.controlsBar.style.display = this.currentPrimaryView === 'finance' ? 'none' : 'flex';
    }

    // Toggle active view panel
    Object.entries(this.viewPanels).forEach(([key, panel]) => {
      if (panel) panel.classList.toggle('active', key === this.currentView);
    });

    this.render();
  }

  switchPlanSubView(subview) {
    if (!['day', 'week', 'month'].includes(subview)) return;
    this.currentPrimaryView = 'plan';
    this.currentPlanSubView = subview;
    this.switchView('plan');
  }

  navigateDate(direction) {
    const d = parseDateISO(this.selectedDate);
    if (this.currentView === 'day') {
      d.setDate(d.getDate() + direction);
    } else if (this.currentView === 'week') {
      d.setDate(d.getDate() + (direction * 7));
    } else if (this.currentView === 'month') {
      d.setMonth(d.getMonth() + direction);
    } else {
      d.setDate(d.getDate() + direction);
    }
    this.selectedDate = formatDateISO(d);
    this.render();
  }

  updateHeaderDate() {
    const d = parseDateISO(this.selectedDate);
    let headingText = '';

    if (this.currentView === 'day') {
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      headingText = d.toLocaleDateString('en-US', options);
      if (this.selectedDate === getTodayISO()) headingText += ' (Today)';
    } else if (this.currentView === 'week') {
      const week = getWeekDays(this.selectedDate);
      const start = week[0].dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = week[6].dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      headingText = `${start} – ${end}`;
    } else if (this.currentView === 'month') {
      headingText = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (this.currentView === 'tasks') {
      headingText = `Task Backlog (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    } else if (this.currentView === 'habits') {
      headingText = `Habits & Recurring Life (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    } else if (this.currentView === 'finance') {
      headingText = 'Financial Planning & Wealth Projections';
    }

    this.currentDateHeading.textContent = headingText;
  }

  async render() {
    this.updateHeaderDate();
    await this.updatePendingBadge();

    switch (this.currentView) {
      case 'day':
        await this.renderDayView();
        break;
      case 'week':
        await this.renderWeekView();
        break;
      case 'month':
        await this.renderMonthView();
        break;
      case 'tasks':
        await this.renderTasksView();
        break;
      case 'habits':
        await this.renderHabitsView();
        break;
      case 'finance':
        await this.renderFinanceView();
        break;
    }
  }

  async updatePendingBadge() {
    const pending = await this.store.getPendingTasks();
    if (this.pendingBadge) {
      this.pendingBadge.textContent = pending.length;
      this.pendingBadge.style.display = pending.length > 0 ? 'inline-block' : 'none';
    }
  }

  filterActivities(activities) {
    let list = activities;
    if (this.selectedPriorityFilter) {
      list = list.filter(a => a.priority === this.selectedPriorityFilter);
    }
    if (this.selectedTypeFilter === 'task') {
      list = list.filter(a => !a.isHabit);
    } else if (this.selectedTypeFilter === 'habit') {
      list = list.filter(a => a.isHabit);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
      );
    }
    return list;
  }

  renderActivityCard(activity) {
    const priorityClass = activity.priority.split('_')[0].toLowerCase();
    const isCompleted = activity.completed;

    const card = document.createElement('div');
    card.className = `activity-card ${priorityClass} ${isCompleted ? 'completed' : ''}`;
    card.dataset.id = activity.id;

    const timeString = activity.startTime
      ? `${activity.startTime}${activity.endTime ? ` - ${activity.endTime}` : ''}`
      : 'All Day';

    card.innerHTML = `
      <div class="custom-checkbox ${isCompleted ? 'checked' : ''}" title="${isCompleted ? 'Mark uncompleted' : 'Mark completed'}">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="activity-content">
        <div class="activity-header">
          <span class="activity-title">
            ${activity.isHabit ? '<span style="color:#a5b4fc;margin-right:0.35rem;" title="Recurring Habit">🌱</span>' : ''}
            ${this.escapeHTML(activity.title)}
          </span>
          <span class="badge-priority ${activity.priority}">
            ${PRIORITY_LABELS[activity.priority] || activity.priority}
          </span>
        </div>
        ${activity.description ? `<p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.35rem;">${this.escapeHTML(activity.description)}</p>` : ''}
        <div class="activity-meta">
          <span class="activity-time">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${timeString}
          </span>
          <span class="activity-tag ${activity.isHabit ? 'habit-tag' : 'task-tag'}">${activity.isHabit ? '🌱 Habit' : 'Task'}</span>
          <span class="activity-time">${activity.date}</span>
        </div>
      </div>
      <div class="activity-actions">
        ${activity.isHabit ? '' : `
        <button class="action-icon-btn edit" title="Edit task">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-icon-btn delete" title="Delete task">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        `}
      </div>
    `;

    // Toggle checkmark handler
    const checkbox = card.querySelector('.custom-checkbox');
    checkbox.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.toggleActivity(activity.id);
    });

    // Edit handler
    card.querySelector('.action-icon-btn.edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openActivityModal(activity);
    });

    // Delete handler
    card.querySelector('.action-icon-btn.delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete task "${activity.title}"?`)) {
        await this.store.deleteActivity(activity.id);
        this.showToast('Task deleted');
        this.queueGoogleDriveSync();
        this.render();
      }
    });

    return card;
  }

  // DAY VIEW
  async renderDayView() {
    const container = document.getElementById('day-activities-list');
    container.innerHTML = '';

    const dayActivities = await this.store.queryActivities({
      date: this.selectedDate,
      includeOverdueForToday: true
    });
    const filtered = this.filterActivities(dayActivities);

    if (this.dayScheduleCount) {
      const taskCount = filtered.filter(a => !a.isHabit).length;
      const habitCount = filtered.filter(a => a.isHabit).length;
      this.dayScheduleCount.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'} (${taskCount} task${taskCount === 1 ? '' : 's'}, ${habitCount} habit${habitCount === 1 ? '' : 's'})`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <h3>No tasks or habits scheduled for this day</h3>
          <p style="margin-top: 0.5rem; font-size: 0.875rem;">Tasks and habits are automatically fetched from their respective tabs.</p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-empty-goto-tasks">Go to Tasks</button>
            <button class="btn btn-secondary" id="btn-empty-goto-habits">Go to Habits</button>
          </div>
        </div>
      `;
      container.querySelector('#btn-empty-goto-tasks')?.addEventListener('click', () => this.switchView('tasks'));
      container.querySelector('#btn-empty-goto-habits')?.addEventListener('click', () => this.switchView('habits'));
      return;
    }

    filtered.forEach(act => {
      container.appendChild(this.renderActivityCard(act));
    });
  }

  // WEEK VIEW
  async renderWeekView() {
    const grid = document.getElementById('week-grid');
    grid.innerHTML = '';

    const weekDays = getWeekDays(this.selectedDate);
    const startDate = weekDays[0].isoString;
    const endDate = weekDays[6].isoString;

    const allWeekActivities = await this.store.queryActivities({ startDate, endDate });

    weekDays.forEach(day => {
      const col = document.createElement('div');
      col.className = `week-column ${day.isToday ? 'today' : ''}`;

      const dayActivities = allWeekActivities.filter(a => a.date === day.isoString);
      const filtered = this.filterActivities(dayActivities);

      col.innerHTML = `
        <div class="week-col-header">
          <span class="day-name">${day.dayNameShort}</span>
          <span class="day-num">${day.dayNumber}</span>
        </div>
        <div class="week-col-body" data-date="${day.isoString}"></div>
      `;

      const colBody = col.querySelector('.week-col-body');
      filtered.forEach(act => {
        const mini = document.createElement('div');
        const pClass = act.priority.split('_')[0].toLowerCase();
        mini.className = `week-activity-mini ${pClass} ${act.completed ? 'completed' : ''}`;
        mini.title = `${act.title} (${act.startTime || 'All day'})`;
        mini.innerHTML = `
          <div class="custom-checkbox ${act.completed ? 'checked' : ''}" style="width:16px;height:16px;margin-top:1px;">
            <svg viewBox="0 0 24 24" width="10" height="10"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${act.isHabit ? '🌱 ' : ''}${this.escapeHTML(act.title)}
            </div>
            ${act.startTime ? `<div style="font-size:0.7rem;color:var(--text-dim);">${act.startTime}</div>` : ''}
          </div>
        `;

        mini.querySelector('.custom-checkbox').addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleActivity(act.id);
        });

        mini.addEventListener('click', () => {
          if (!act.isHabit) this.openActivityModal(act);
        });

        colBody.appendChild(mini);
      });

      col.querySelector('.week-col-header').addEventListener('click', () => {
        this.selectedDate = day.isoString;
        this.openActivityModal({ date: day.isoString });
      });

      grid.appendChild(col);
    });
  }

  // MONTH VIEW
  async renderMonthView() {
    const grid = document.getElementById('month-grid');
    grid.innerHTML = '';

    const d = parseDateISO(this.selectedDate);
    const cells = getMonthGrid(d.getFullYear(), d.getMonth());

    const startDate = cells[0].isoString;
    const endDate = cells[cells.length - 1].isoString;
    const monthActivities = await this.store.queryActivities({ startDate, endDate });

    cells.forEach(cell => {
      const cellEl = document.createElement('div');
      cellEl.className = `month-cell ${cell.isCurrentMonth ? '' : 'not-current-month'} ${cell.isToday ? 'today' : ''}`;

      const dayActs = monthActivities.filter(a => a.date === cell.isoString);
      const filtered = this.filterActivities(dayActs);

      cellEl.innerHTML = `
        <div class="month-cell-header">
          <span class="cell-date-num">${cell.dayNumber}</span>
          ${filtered.length > 0 ? `<span style="font-size:0.7rem;color:var(--text-dim);">${filtered.length}</span>` : ''}
        </div>
        <div class="month-cell-activities"></div>
      `;

      const actsWrap = cellEl.querySelector('.month-cell-activities');
      filtered.slice(0, 3).forEach(act => {
        const pClass = act.priority.split('_')[0].toLowerCase();
        const pill = document.createElement('div');
        pill.className = `month-badge-pill ${pClass} ${act.completed ? 'completed' : ''}`;
        pill.innerHTML = `<span>•</span> <span>${this.escapeHTML(act.title)}</span>`;
        actsWrap.appendChild(pill);
      });

      if (filtered.length > 3) {
        const more = document.createElement('div');
        more.style.fontSize = '0.65rem';
        more.style.color = 'var(--text-dim)';
        more.textContent = `+${filtered.length - 3} more`;
        actsWrap.appendChild(more);
      }

      cellEl.addEventListener('click', () => {
        this.selectedDate = cell.isoString;
        this.switchView('day');
      });

      grid.appendChild(cellEl);
    });
  }

  // TASKS VIEW (Unticked Backlog)
  async renderTasksView() {
    const container = document.getElementById('tasks-view-container');
    container.innerHTML = '';

    const pending = await this.store.getPendingTasks(getTodayISO());
    const filtered = this.filterActivities(pending);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" style="color: #10b981;">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h3>All caught up!</h3>
          <p style="margin-top: 0.5rem; font-size: 0.875rem;">No unticked tasks remaining in your backlog.</p>
          <button class="btn btn-primary" id="btn-empty-add-task" style="margin-top: 1rem;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Add Task</span>
          </button>
        </div>
      `;
      container.querySelector('#btn-empty-add-task')?.addEventListener('click', () => {
        this.openActivityModal({ date: getTodayISO() });
      });
      return;
    }

    const groups = {
      OVERDUE: { title: 'Overdue Activities', class: 'overdue', list: [] },
      TODAY: { title: "Today's Unticked Tasks", class: 'today', list: [] },
      UPCOMING: { title: 'Upcoming Activities', class: 'upcoming', list: [] }
    };

    filtered.forEach(task => {
      if (groups[task.statusCategory]) {
        groups[task.statusCategory].list.push(task);
      }
    });

    Object.entries(groups).forEach(([key, group]) => {
      if (group.list.length === 0) return;

      const section = document.createElement('div');
      section.className = 'task-section-group';

      section.innerHTML = `
        <div class="section-title-wrap">
          <h3 class="section-title ${group.class}">
            <span>${group.title}</span>
            <span class="badge-count" style="font-size:0.75rem;padding:0.15rem 0.5rem;background:var(--border-subtle);">${group.list.length}</span>
          </h3>
        </div>
        <div class="day-activities-list"></div>
      `;

      const listWrap = section.querySelector('.day-activities-list');
      group.list.forEach(item => {
        listWrap.appendChild(this.renderActivityCard(item));
      });

      container.appendChild(section);
    });
  }

  // ------------------------------------
  // HABITS VIEW (Creative & Rich Habit Page)
  // ------------------------------------
  async renderHabitsView() {
    const habits = await this.store.getAllHabits();
    const todayIso = getTodayISO();

    // 1. Compute overall momentum stats
    let totalScheduledToday = 0;
    let completedTodayCount = 0;
    let longestStreak = 0;

    habits.forEach(h => {
      const stats = calculateHabitStats(h, todayIso);
      if (stats.bestStreak > longestStreak) longestStreak = stats.bestStreak;

      const isTodayScheduled = stats.historyLast14d[stats.historyLast14d.length - 1]?.isTargetDay;
      const isTodayCompleted = stats.historyLast14d[stats.historyLast14d.length - 1]?.completed;

      if (isTodayScheduled) {
        totalScheduledToday++;
        if (isTodayCompleted) completedTodayCount++;
      }
    });

    if (this.statActiveHabits) this.statActiveHabits.textContent = habits.length;
    if (this.statCompletedToday) this.statCompletedToday.textContent = `${completedTodayCount} / ${totalScheduledToday}`;
    if (this.statLongestStreak) this.statLongestStreak.textContent = `${longestStreak} Days`;

    // 2. Render Habit Category Filters
    if (this.habitCategoryFilters) {
      this.habitCategoryFilters.innerHTML = '';
      const categories = ['ALL', ...HABIT_CATEGORIES];

      categories.forEach(cat => {
        const pill = document.createElement('button');
        pill.className = `btn btn-secondary ${this.selectedHabitCategory === cat ? 'active' : ''}`;
        pill.style.padding = '0.3rem 0.75rem';
        pill.style.fontSize = '0.75rem';
        if (this.selectedHabitCategory === cat) {
          pill.style.background = 'var(--accent-primary)';
          pill.style.color = '#fff';
        }
        pill.textContent = cat === 'ALL' ? 'All Habits' : cat;
        pill.addEventListener('click', () => {
          this.selectedHabitCategory = cat;
          this.renderHabitsView();
        });
        this.habitCategoryFilters.appendChild(pill);
      });
    }

    // 3. Filter habits
    let displayHabits = habits;
    if (this.selectedHabitCategory !== 'ALL') {
      displayHabits = displayHabits.filter(h => (h.category || '').toLowerCase() === this.selectedHabitCategory.toLowerCase());
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      displayHabits = displayHabits.filter(h =>
        h.title.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q)) ||
        (h.category && h.category.toLowerCase().includes(q))
      );
    }

    // 4. Render Habit Cards Grid
    if (!this.habitsGrid) return;
    this.habitsGrid.innerHTML = '';

    if (displayHabits.length === 0) {
      this.habitsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon" style="color: #6366f1;">🌱</div>
          <h3>No habits established yet</h3>
          <p style="margin-top: 0.5rem; font-size: 0.875rem;">Build a consistent routine by clicking "Build New Habit" or pressing <kbd>H</kbd>.</p>
        </div>
      `;
      return;
    }

    displayHabits.forEach(habit => {
      const stats = calculateHabitStats(habit, todayIso);
      const isTodayCompleted = Boolean(habit.completions && habit.completions[todayIso]);
      const recurrenceLabel = RECURRENCE_LABELS[habit.recurrence?.frequency] || 'Daily';

      const card = document.createElement('div');
      card.className = 'habit-card';

      // Date bounds badge label
      let dateBoundsLabel = '';
      const sDate = habit.startDate || habit.recurrence?.startDate;
      const eDate = habit.endDate || habit.recurrence?.endDate;
      if (sDate && eDate) {
        dateBoundsLabel = `${sDate} – ${eDate}`;
      } else if (sDate) {
        dateBoundsLabel = `From ${sDate}`;
      } else if (eDate) {
        dateBoundsLabel = `Until ${eDate}`;
      }

      // Build 14-day history dots HTML
      const dotsHtml = stats.historyLast14d.map(entry => {
        let dotClass = 'history-dot';
        if (entry.completed) dotClass += ' completed';
        if (entry.isToday) dotClass += ' is-today';
        if (!entry.isTargetDay) dotClass += ' not-scheduled';
        const tooltip = `${entry.date} (${entry.dayNameShort}): ${entry.completed ? 'Done ✓' : (entry.isTargetDay ? 'Pending' : 'Off day')}`;
        return `<div class="${dotClass}" data-date="${entry.date}" data-tooltip="${tooltip}"></div>`;
      }).join('');

      card.innerHTML = `
        <div class="habit-card-header">
          <div class="habit-title-area">
            <h4 class="habit-title">${this.escapeHTML(habit.title)}</h4>
            <div class="habit-badges-row">
              <span class="habit-category-pill">${this.escapeHTML(habit.category)}</span>
              <span class="habit-recurrence-pill">${recurrenceLabel}</span>
              ${dateBoundsLabel ? `<span class="habit-recurrence-pill" style="opacity:0.85;">📅 ${dateBoundsLabel}</span>` : ''}
              ${habit.timeOfDay && habit.timeOfDay !== 'anytime' ? `<span class="habit-category-pill">${habit.timeOfDay}</span>` : ''}
            </div>
          </div>
          <div class="activity-actions" style="opacity: 1;">
            <button class="action-icon-btn edit" title="Edit habit">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-icon-btn delete" title="Delete habit">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        ${habit.description ? `<p style="font-size: 0.8rem; color: var(--text-muted);">${this.escapeHTML(habit.description)}</p>` : ''}

        <!-- Interactive Today Action Box -->
        <div class="habit-today-action ${isTodayCompleted ? 'completed' : ''}">
          <div class="habit-today-label">
            <span class="habit-today-title">${isTodayCompleted ? 'Completed Today ✓' : 'Mark Today Complete'}</span>
            <span class="habit-today-sub">${isTodayCompleted ? 'Awesome job maintaining momentum!' : 'Tap to record habit completion'}</span>
          </div>
          <div class="custom-checkbox ${isTodayCompleted ? 'checked' : ''}" style="width: 26px; height: 26px;">
            <svg viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>

        <!-- Streaks & Consistency Metrics -->
        <div class="habit-streaks-row">
          <span class="streak-pill current" title="Current consecutive streak">🔥 ${stats.currentStreak} Days</span>
          <span class="streak-pill best" title="Personal best streak">🏆 Best ${stats.bestStreak}</span>
          <span class="streak-pill rate" title="30-day completion consistency">📈 ${stats.completionRate30d}%</span>
        </div>

        <!-- 14-Day Micro Heatmap Strip -->
        <div class="habit-history-strip">
          <div class="strip-label-row">
            <span>Past 14 Days</span>
            <span>Today</span>
          </div>
          <div class="history-dots-row">${dotsHtml}</div>
        </div>
      `;

      // Today action click handler
      card.querySelector('.habit-today-action').addEventListener('click', async () => {
        await this.toggleHabitDate(habit.id, todayIso);
      });

      // Click on any history dot to toggle that date
      card.querySelectorAll('.history-dot').forEach(dot => {
        dot.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetDate = dot.dataset.date;
          await this.toggleHabitDate(habit.id, targetDate);
        });
      });

      // Edit Habit
      card.querySelector('.action-icon-btn.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openHabitModal(habit);
      });

      // Delete Habit
      card.querySelector('.action-icon-btn.delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete habit "${habit.title}"? Your completion history will be removed.`)) {
          await this.store.deleteHabit(habit.id);
          this.showToast('Habit removed');
          this.queueGoogleDriveSync();
          this.render();
        }
      });

      this.habitsGrid.appendChild(card);
    });
  }

  async toggleHabitDate(habitId, dateIso) {
    try {
      const res = await this.store.toggleHabitDate(habitId, dateIso);
      this.showToast(res.completed ? `Habit completed for ${dateIso}! 🔥` : `Marked incomplete for ${dateIso}`);
      this.queueGoogleDriveSync();
      await this.render();
    } catch (e) {
      this.showToast(`Error: ${e.message}`, true);
    }
  }

  openHabitModal(preset = {}) {
    this.editingHabitId = preset.id || null;
    this.habitModalTitle.textContent = this.editingHabitId ? 'Edit Habit' : 'Build New Habit';

    document.getElementById('form-habit-id').value = preset.id || '';
    document.getElementById('form-habit-title').value = preset.title || '';
    document.getElementById('form-habit-category').value = preset.category || 'Health';
    document.getElementById('form-habit-time-of-day').value = preset.timeOfDay || 'anytime';
    document.getElementById('form-habit-recurrence').value = preset.recurrence?.frequency || 'DAILY';
    document.getElementById('form-habit-start-date').value = preset.startDate || preset.recurrence?.startDate || '';
    document.getElementById('form-habit-end-date').value = preset.endDate || preset.recurrence?.endDate || '';
    document.getElementById('form-habit-start-time').value = preset.startTime || '';
    document.getElementById('form-habit-priority').value = preset.priority || 'P3_MEDIUM';
    document.getElementById('form-habit-description').value = preset.description || '';

    // Days of week toggles
    const isWeekly = preset.recurrence?.frequency === 'WEEKLY';
    if (this.habitDaysGroup) {
      this.habitDaysGroup.style.display = isWeekly ? 'block' : 'none';
      const days = preset.recurrence?.daysOfWeek || [1, 3, 5];
      [0, 1, 2, 3, 4, 5, 6].forEach(d => {
        const chk = document.getElementById(`dow-${d}`);
        if (chk) chk.checked = days.includes(d);
      });
    }

    this.habitModal.classList.add('open');
    setTimeout(() => document.getElementById('form-habit-title').focus(), 50);
  }

  async handleHabitSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('form-habit-title').value.trim();
    const category = document.getElementById('form-habit-category').value;
    const timeOfDay = document.getElementById('form-habit-time-of-day').value;
    const frequency = document.getElementById('form-habit-recurrence').value;
    const startDate = document.getElementById('form-habit-start-date').value || null;
    const endDate = document.getElementById('form-habit-end-date').value || null;
    const startTime = document.getElementById('form-habit-start-time').value || null;
    const priority = document.getElementById('form-habit-priority').value;
    const description = document.getElementById('form-habit-description').value.trim();

    const daysOfWeek = [];
    if (frequency === 'WEEKLY') {
      [0, 1, 2, 3, 4, 5, 6].forEach(d => {
        if (document.getElementById(`dow-${d}`)?.checked) {
          daysOfWeek.push(parseInt(d, 10));
        }
      });
      if (daysOfWeek.length === 0) daysOfWeek.push(1, 3, 5);
    }

    const recurrence = {
      frequency,
      daysOfWeek: frequency === 'WEEKLY' ? daysOfWeek : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };

    try {
      if (this.editingHabitId) {
        await this.store.updateHabit(this.editingHabitId, {
          title,
          category,
          timeOfDay,
          startDate,
          endDate,
          recurrence,
          startTime,
          priority,
          description
        });
        this.showToast('Habit updated');
      } else {
        await this.store.createHabit({
          title,
          category,
          timeOfDay,
          startDate,
          endDate,
          recurrence,
          startTime,
          priority,
          description
        });
        this.showToast('New habit established! 🌱');
      }

      this.closeModals();
      this.queueGoogleDriveSync();
      this.render();
    } catch (err) {
      alert(`Error saving habit: ${err.message}`);
    }
  }

  async toggleActivity(id) {
    try {
      const toggled = await this.store.toggleActivity(id);
      this.showToast(toggled.completed ? 'Activity completed!' : 'Marked active');
      this.queueGoogleDriveSync();
      await this.render();
    } catch (e) {
      this.showToast(`Error: ${e.message}`, true);
    }
  }

  openActivityModal(preset = {}) {
    this.editingActivityId = preset.id || null;
    this.modalTitle.textContent = this.editingActivityId ? 'Edit Task' : 'Create New Task';

    document.getElementById('form-activity-id').value = preset.id || '';
    document.getElementById('form-title').value = preset.title || '';
    document.getElementById('form-date').value = preset.date || this.selectedDate;
    document.getElementById('form-start-time').value = preset.startTime || '';
    document.getElementById('form-end-time').value = preset.endTime || '';
    document.getElementById('form-description').value = preset.description || '';

    const priority = preset.priority || PRIORITIES.P3_MEDIUM;
    const prioRadio = document.querySelector(`input[name="priority"][value="${priority}"]`);
    if (prioRadio) prioRadio.checked = true;

    this.activityModal.classList.add('open');
    setTimeout(() => document.getElementById('form-title').focus(), 50);
  }

  async handleActivitySubmit(e) {
    e.preventDefault();

    const title = document.getElementById('form-title').value.trim();
    const date = document.getElementById('form-date').value;
    const startTime = document.getElementById('form-start-time').value || null;
    const endTime = document.getElementById('form-end-time').value || null;
    const description = document.getElementById('form-description').value.trim();
    const priority = document.querySelector('input[name="priority"]:checked')?.value || PRIORITIES.P3_MEDIUM;

    try {
      if (this.editingActivityId) {
        await this.store.updateActivity(this.editingActivityId, {
          title,
          date,
          startTime,
          endTime,
          description,
          priority
        });
        this.showToast('Task updated');
      } else {
        await this.store.createActivity({
          title,
          date,
          startTime,
          endTime,
          description,
          priority
        });
        this.showToast('Task created');
      }

      this.closeModals();
      this.queueGoogleDriveSync();
      this.render();
    } catch (err) {
      alert(`Error saving task: ${err.message}`);
    }
  }

  openBackupModal() {
    this.backupModal.classList.add('open');
  }

  closeModals() {
    this.activityModal.classList.remove('open');
    this.backupModal.classList.remove('open');
    this.gdriveModal.classList.remove('open');
    this.habitModal?.classList.remove('open');
    this.financeModal?.classList.remove('open');
    this.editingActivityId = null;
    this.editingHabitId = null;
    this.editingFinanceId = null;
  }

  async handleExportData() {
    const jsonStr = await this.store.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dayplanner-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Backup downloaded');
  }

  async handleImportData() {
    const input = document.getElementById('import-file-input');
    if (!input.files || input.files.length === 0) {
      alert('Please choose a JSON backup file first.');
      return;
    }
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const res = await this.store.importData(e.target.result);
        this.showToast(`Imported ${res.imported} records successfully!`);
        this.closeModals();
        this.queueGoogleDriveSync();
        this.render();
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  /* ==========================================================================
     Financial Planning & Wealth Projections View
     ========================================================================== */

  async renderFinanceView() {
    try {
      const forecast = await this.store.getFinancialForecast({ horizonMonths: this.financeHorizonMonths });
      const records = await this.store.getAllFinanceRecords();

      // Update KPI Cards
      if (this.kpiProjectedSavings) {
        this.kpiProjectedSavings.textContent = formatRupees(forecast.totalProjectedSavings);
        this.kpiProjectedSavings.className = `kpi-value ${forecast.totalProjectedSavings >= 0 ? 'positive' : 'negative'}`;
      }
      if (this.kpiSavingsHorizon) {
        this.kpiSavingsHorizon.textContent = `Next ${this.financeHorizonMonths} Months (${forecast.totalProjectedSavings >= 0 ? 'Surplus' : 'Deficit'})`;
      }
      if (this.kpiAvgIncome) {
        this.kpiAvgIncome.textContent = formatRupees(forecast.averageMonthlyIncome);
      }
      if (this.kpiAvgExpense) {
        this.kpiAvgExpense.textContent = formatRupees(forecast.averageMonthlyExpense);
      }
      if (this.kpiSavingsRate) {
        const rate = forecast.averageMonthlyIncome > 0
          ? Math.round((forecast.averageMonthlySavings / forecast.averageMonthlyIncome) * 100)
          : 0;
        this.kpiSavingsRate.textContent = `${rate}%`;
        if (this.kpiRateSubtext) {
          if (rate >= 30) this.kpiRateSubtext.textContent = 'Excellent savings buffer';
          else if (rate > 0) this.kpiRateSubtext.textContent = 'Positive cash flow';
          else if (rate === 0) this.kpiRateSubtext.textContent = 'Breaking even';
          else this.kpiRateSubtext.textContent = 'Spending exceeds income';
        }
      }

      // Render Charts
      if (this.chartCashflowContainer) {
        this.chartCashflowContainer.innerHTML = generateCashFlowBarChartSvg(forecast.monthlyForecasts, 720, 260);
      }
      if (this.chartSavingsContainer) {
        this.chartSavingsContainer.innerHTML = generateSavingsTrajectorySvg(forecast.monthlyForecasts, 440, 220);
      }
      if (this.chartCategoriesContainer) {
        this.chartCategoriesContainer.innerHTML = generateCategoryDonutSvg(forecast.expenseCategoryBreakdown, 210);
      }

      // Render Monthly Forecast Table
      if (this.financeForecastTableContainer) {
        if (!forecast.monthlyForecasts || forecast.monthlyForecasts.length === 0) {
          this.financeForecastTableContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No forecast data available.</div>`;
        } else {
          let tableHtml = `
            <table class="finance-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total Income</th>
                  <th>Money Needed</th>
                  <th>Net Cash Flow</th>
                  <th>Cumulative Savings</th>
                  <th>Savings Rate</th>
                </tr>
              </thead>
              <tbody>
          `;
          forecast.monthlyForecasts.forEach(m => {
            const isSurplus = m.netSavings >= 0;
            tableHtml += `
              <tr>
                <td><strong>${this.escapeHTML(m.monthLabel)}</strong></td>
                <td style="color: #34d399; font-weight: 600;">${formatRupees(m.totalIncome)}</td>
                <td style="color: #fb7185; font-weight: 600;">${formatRupees(m.totalExpense)}</td>
                <td class="${isSurplus ? 'text-surplus' : 'text-deficit'}">
                  ${isSurplus ? '+' : ''}${formatRupees(m.netSavings)}
                </td>
                <td style="font-weight: 700;">${formatRupees(m.cumulativeSavings)}</td>
                <td>${m.savingsRate}%</td>
              </tr>
            `;
          });
          tableHtml += `</tbody></table>`;
          this.financeForecastTableContainer.innerHTML = tableHtml;
        }
      }

      // Render Recurring Items List
      if (this.financeRecordsContainer) {
        let filteredRecords = records;
        if (this.selectedFinanceFilter && this.selectedFinanceFilter !== 'ALL') {
          filteredRecords = filteredRecords.filter(r => r.type === this.selectedFinanceFilter);
        }

        if (filteredRecords.length === 0) {
          this.financeRecordsContainer.innerHTML = `
            <div style="grid-column: 1 / -1; background: var(--bg-surface-elevated); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 3rem 1.5rem; text-align: center;">
              <div style="font-size: 2.25rem; margin-bottom: 0.75rem;">💰</div>
              <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.35rem;">No Recurring Cash Flow Items</h4>
              <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 440px; margin: 0 auto 1.25rem auto;">
                Add your recurring incomes (salary, investments) and expenses (rent, EMIs, utilities, groceries) to predict your upcoming money requirements.
              </p>
              <button class="btn btn-primary" id="btn-empty-add-finance" style="background: linear-gradient(135deg, #10b981, #059669);">
                + Add First Cash Flow
              </button>
            </div>
          `;
          document.getElementById('btn-empty-add-finance')?.addEventListener('click', () => {
            this.openFinanceModal();
          });
        } else {
          this.financeRecordsContainer.innerHTML = '';
          filteredRecords.forEach(rec => {
            const isIncome = rec.type === 'INCOME';
            const periodicityText = rec.periodicity === 'CUSTOM'
              ? `Every ${rec.intervalMonths || 1} Months`
              : (rec.periodicity.charAt(0) + rec.periodicity.slice(1).toLowerCase());

            const card = document.createElement('div');
            card.className = 'finance-record-card';
            card.dataset.id = rec.id;

            card.innerHTML = `
              <div class="record-top-row">
                <div class="record-badge-wrap">
                  <span class="record-type-pill ${isIncome ? 'income' : 'expense'}">
                    ${isIncome ? '↗ Income' : '↘ Expense'}
                  </span>
                  <span class="record-category-tag">${this.escapeHTML(rec.category || 'General')}</span>
                </div>
                <span class="record-amount ${isIncome ? 'income' : 'expense'}">
                  ${isIncome ? '+' : '-'}${formatRupees(rec.amount)}
                </span>
              </div>

              <div class="record-name">${this.escapeHTML(rec.name)}</div>

              <div class="record-meta-list">
                <div class="record-meta-item">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span><strong>Periodicity:</strong> ${periodicityText}</span>
                </div>
                <div class="record-meta-item">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <span><strong>Payment Date:</strong> Day ${rec.defaultPaymentDate} ${rec.dueDate ? `(Due: Day ${rec.dueDate})` : ''}</span>
                </div>
                ${(rec.startDate || rec.endDate) ? `
                  <div class="record-meta-item">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    <span><strong>Active:</strong> ${rec.startDate || 'Start'} &rarr; ${rec.endDate || 'Ongoing'}</span>
                  </div>
                ` : ''}
                ${rec.notes ? `
                  <div class="record-meta-item" style="color: var(--text-muted); font-style: italic;">
                    ${this.escapeHTML(rec.notes)}
                  </div>
                ` : ''}
              </div>

              <div class="record-actions">
                <button class="btn btn-secondary btn-icon btn-edit-finance" title="Edit Cash Flow" style="padding: 0.35rem 0.65rem;">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn btn-secondary btn-icon btn-delete-finance" title="Delete Cash Flow" style="padding: 0.35rem 0.65rem; color: var(--p1-color);">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            `;

            card.querySelector('.btn-edit-finance').addEventListener('click', () => {
              this.openFinanceModal(rec);
            });

            card.querySelector('.btn-delete-finance').addEventListener('click', () => {
              this.deleteFinanceRecord(rec.id);
            });

            this.financeRecordsContainer.appendChild(card);
          });
        }
      }
    } catch (err) {
      console.error('Error rendering finance view:', err);
      this.showToast(`Finance render error: ${err.message}`, true);
    }
  }

  openFinanceModal(preset = {}) {
    this.editingFinanceId = preset.id || null;
    this.financeModalTitle.textContent = this.editingFinanceId ? 'Edit Recurring Cash Flow' : 'Add Recurring Cash Flow';

    document.getElementById('form-finance-id').value = preset.id || '';
    document.getElementById('form-finance-name').value = preset.name || '';
    document.getElementById('form-finance-amount').value = preset.amount !== undefined ? preset.amount : '';
    document.getElementById('form-finance-periodicity').value = preset.periodicity || 'MONTHLY';
    document.getElementById('form-finance-interval').value = preset.intervalMonths || 2;
    document.getElementById('form-finance-due-date').value = preset.dueDate || '';
    document.getElementById('form-finance-payment-date').value = preset.defaultPaymentDate || 1;
    document.getElementById('form-finance-category').value = preset.category || 'Salary';
    document.getElementById('form-finance-start-date').value = preset.startDate || '';
    document.getElementById('form-finance-end-date').value = preset.endDate || '';
    document.getElementById('form-finance-notes').value = preset.notes || '';

    const type = preset.type || 'EXPENSE';
    const typeRadio = document.querySelector(`input[name="finance-type"][value="${type}"]`);
    if (typeRadio) typeRadio.checked = true;

    if (this.financeCustomIntervalGroup) {
      this.financeCustomIntervalGroup.style.display = preset.periodicity === 'CUSTOM' ? 'block' : 'none';
    }

    this.financeModal.classList.add('open');
    setTimeout(() => document.getElementById('form-finance-name').focus(), 50);
  }

  async handleFinanceSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('form-finance-name').value.trim();
    const type = document.querySelector('input[name="finance-type"]:checked')?.value || 'EXPENSE';
    const amount = parseFloat(document.getElementById('form-finance-amount').value);
    const periodicity = document.getElementById('form-finance-periodicity').value;
    const intervalMonths = periodicity === 'CUSTOM' ? parseInt(document.getElementById('form-finance-interval').value, 10) || 1 : undefined;
    const dueDateVal = document.getElementById('form-finance-due-date').value;
    const dueDate = dueDateVal ? parseInt(dueDateVal, 10) : null;
    const defaultPaymentDate = parseInt(document.getElementById('form-finance-payment-date').value, 10) || 1;
    const category = document.getElementById('form-finance-category').value;
    const startDate = document.getElementById('form-finance-start-date').value || null;
    const endDate = document.getElementById('form-finance-end-date').value || null;
    const notes = document.getElementById('form-finance-notes').value.trim();

    const payload = {
      name,
      type,
      amount,
      periodicity,
      intervalMonths,
      dueDate,
      defaultPaymentDate,
      category,
      startDate,
      endDate,
      notes
    };

    try {
      if (this.editingFinanceId) {
        await this.store.updateFinanceRecord(this.editingFinanceId, payload);
        this.showToast('Cash flow updated');
      } else {
        await this.store.createFinanceRecord(payload);
        this.showToast('Cash flow added');
      }

      this.closeModals();
      this.queueGoogleDriveSync();
      if (this.currentView === 'finance') {
        await this.renderFinanceView();
      }
    } catch (err) {
      alert(`Error saving cash flow: ${err.message}`);
    }
  }

  async deleteFinanceRecord(id) {
    if (!confirm('Are you sure you want to delete this recurring cash flow item?')) return;
    try {
      await this.store.deleteFinanceRecord(id);
      this.showToast('Cash flow removed');
      this.queueGoogleDriveSync();
      if (this.currentView === 'finance') {
        await this.renderFinanceView();
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, true);
    }
  }

  showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isError) toast.style.borderColor = 'var(--p1-color)';
    toast.textContent = message;

    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
}

// Bootstrap once DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.dayPlannerApp = new DayPlannerApp();
    window.dayPlannerApp.render();
  });
}
