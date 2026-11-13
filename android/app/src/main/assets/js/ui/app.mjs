/**
 * DayPlanner Application UI Controller with Confidential Google Drive Sync
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

export class DayPlannerApp {
  constructor() {
    this.store = createPlannerStore();
    this.gdrive = new GoogleDriveSyncEngine();
    this.syncTimeout = null;

    this.currentView = 'day'; // 'day' | 'week' | 'month' | 'tasks'
    this.selectedDate = getTodayISO();
    this.searchQuery = '';
    this.selectedPriorityFilter = '';
    this.selectedCategoryFilter = '';
    this.editingActivityId = null;

    this.cacheElements();
    this.bindEvents();
    this.initPWA();
    this.initGDrive();
  }

  cacheElements() {
    this.navBtns = document.querySelectorAll('.view-nav-btn');
    this.viewPanels = {
      day: document.getElementById('view-day'),
      week: document.getElementById('view-week'),
      month: document.getElementById('view-month'),
      tasks: document.getElementById('view-tasks')
    };

    this.pendingBadge = document.getElementById('tasks-pending-badge');
    this.currentDateHeading = document.getElementById('current-date-heading');
    this.prevBtn = document.getElementById('btn-prev');
    this.nextBtn = document.getElementById('btn-next');
    this.todayBtn = document.getElementById('btn-today');

    this.searchInput = document.getElementById('search-input');
    this.priorityFilter = document.getElementById('priority-filter');
    this.categoryFilter = document.getElementById('category-filter');

    // Modals
    this.activityModal = document.getElementById('activity-modal');
    this.activityForm = document.getElementById('activity-form');
    this.modalTitle = document.getElementById('modal-title');
    this.backupModal = document.getElementById('backup-modal');
    this.gdriveModal = document.getElementById('gdrive-modal');

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
    // View Switcher
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
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

    this.priorityFilter.addEventListener('change', (e) => {
      this.selectedPriorityFilter = e.target.value;
      this.render();
    });

    this.categoryFilter.addEventListener('change', (e) => {
      this.selectedCategoryFilter = e.target.value;
      this.render();
    });

    // Open Add Activity Modal
    document.getElementById('btn-new-activity').addEventListener('click', () => {
      this.openActivityModal();
    });

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
      } else if (e.key === '1') {
        this.switchView('day');
      } else if (e.key === '2') {
        this.switchView('week');
      } else if (e.key === '3') {
        this.switchView('month');
      } else if (e.key === '4') {
        this.switchView('tasks');
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
    // Populate saved Client ID
    if (this.gdriveClientIdInput) {
      this.gdriveClientIdInput.value = this.gdrive.getClientId() || '';
    }

    // Subscribe to status changes
    this.gdrive.onStatusChange((status, profile) => {
      this.updateGDriveUI(status, profile);
    });

    this.updateGDriveUI(this.gdrive.status, this.gdrive.getProfile());

    // If authenticated on reload, pull latest
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
      const localActivities = await this.store.queryActivities();
      const result = await this.gdrive.syncNow(localActivities);

      // Re-populate store with merged records
      if (result.merged && result.merged.length > 0) {
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
    if (!this.viewPanels[viewName]) return;
    this.currentView = viewName;

    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    Object.entries(this.viewPanels).forEach(([key, panel]) => {
      panel.classList.toggle('active', key === viewName);
    });

    this.render();
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
    } else {
      headingText = `Task Backlog (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    }

    this.currentDateHeading.textContent = headingText;
  }

  async render() {
    this.updateHeaderDate();
    await this.updatePendingBadge();
    await this.populateCategoryFilter();

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
    }
  }

  async updatePendingBadge() {
    const pending = await this.store.getPendingTasks();
    if (this.pendingBadge) {
      this.pendingBadge.textContent = pending.length;
      this.pendingBadge.style.display = pending.length > 0 ? 'inline-block' : 'none';
    }
  }

  async populateCategoryFilter() {
    const all = await this.store.queryActivities();
    const categories = Array.from(new Set(all.map(a => a.category || 'General'))).sort();
    
    const currentVal = this.categoryFilter.value;
    this.categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentVal) opt.selected = true;
      this.categoryFilter.appendChild(opt);
    });
  }

  filterActivities(activities) {
    let list = activities;
    if (this.selectedPriorityFilter) {
      list = list.filter(a => a.priority === this.selectedPriorityFilter);
    }
    if (this.selectedCategoryFilter) {
      list = list.filter(a => (a.category || 'General').toLowerCase() === this.selectedCategoryFilter.toLowerCase());
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q))
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
          <span class="activity-title">${this.escapeHTML(activity.title)}</span>
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
          <span class="activity-tag">${this.escapeHTML(activity.category || 'General')}</span>
          <span class="activity-time">${activity.date}</span>
        </div>
      </div>
      <div class="activity-actions">
        <button class="action-icon-btn edit" title="Edit activity">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-icon-btn delete" title="Delete activity">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Toggle checkmark handler
    const checkbox = card.querySelector('.custom-checkbox');
    checkbox.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.toggleActivity(activity.id);
    });

    // Edit handler
    card.querySelector('.action-icon-btn.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openActivityModal(activity);
    });

    // Delete handler
    card.querySelector('.action-icon-btn.delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete activity "${activity.title}"?`)) {
        await this.store.deleteActivity(activity.id);
        this.showToast('Activity deleted');
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

    const dayActivities = await this.store.queryActivities({ date: this.selectedDate });
    const filtered = this.filterActivities(dayActivities);

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
          <h3>No activities planned for this day</h3>
          <p style="margin-top: 0.5rem; font-size: 0.875rem;">Click "+ New Activity" or press <kbd>N</kbd> to schedule something.</p>
        </div>
      `;
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
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHTML(act.title)}</div>
            ${act.startTime ? `<div style="font-size:0.7rem;color:var(--text-dim);">${act.startTime}</div>` : ''}
          </div>
        `;

        mini.querySelector('.custom-checkbox').addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleActivity(act.id);
        });

        mini.addEventListener('click', () => {
          this.openActivityModal(act);
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
        </div>
      `;
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
    this.modalTitle.textContent = this.editingActivityId ? 'Edit Activity' : 'Plan New Activity';

    document.getElementById('form-activity-id').value = preset.id || '';
    document.getElementById('form-title').value = preset.title || '';
    document.getElementById('form-date').value = preset.date || this.selectedDate;
    document.getElementById('form-start-time').value = preset.startTime || '';
    document.getElementById('form-end-time').value = preset.endTime || '';
    document.getElementById('form-category').value = preset.category || 'General';
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
    const category = document.getElementById('form-category').value.trim() || 'General';
    const description = document.getElementById('form-description').value.trim();
    const priority = document.querySelector('input[name="priority"]:checked')?.value || PRIORITIES.P3_MEDIUM;

    try {
      if (this.editingActivityId) {
        await this.store.updateActivity(this.editingActivityId, {
          title,
          date,
          startTime,
          endTime,
          category,
          description,
          priority
        });
        this.showToast('Activity updated');
      } else {
        await this.store.createActivity({
          title,
          date,
          startTime,
          endTime,
          category,
          description,
          priority
        });
        this.showToast('Activity scheduled');
      }

      this.closeModals();
      this.queueGoogleDriveSync();
      this.render();
    } catch (err) {
      alert(`Error saving activity: ${err.message}`);
    }
  }

  openBackupModal() {
    this.backupModal.classList.add('open');
  }

  closeModals() {
    this.activityModal.classList.remove('open');
    this.backupModal.classList.remove('open');
    this.gdriveModal.classList.remove('open');
    this.editingActivityId = null;
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
        this.showToast(`Imported ${res.imported} activities successfully!`);
        this.closeModals();
        this.queueGoogleDriveSync();
        this.render();
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
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
