/**
 * Google Drive Confidential User Storage & Sync Engine
 * Uses Google Drive REST API v3 with appDataFolder isolation
 */

export function formatSyncTimestamp(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Merges two arrays of records resolving conflicts by newest `updatedAt`
 */
export function mergeDatasetsByTimestamp(localItems = [], remoteItems = []) {
  const map = new Map();

  // Index remote items first
  for (const item of remoteItems) {
    if (item && item.id) {
      map.set(item.id, { ...item });
    }
  }

  // Merge or overwrite with local items
  for (const local of localItems) {
    if (!local || !local.id) continue;

    if (!map.has(local.id)) {
      map.set(local.id, { ...local });
    } else {
      const existing = map.get(local.id);
      const localTime = Date.parse(local.updatedAt || local.createdAt || 0);
      const remoteTime = Date.parse(existing.updatedAt || existing.createdAt || 0);

      if (localTime >= remoteTime) {
        map.set(local.id, { ...local });
      }
    }
  }

  return Array.from(map.values());
}

export class GoogleDriveSyncEngine {
  constructor(options = {}) {
    this.clientId = options.clientId || '';
    this.fileName = options.fileName || 'dayplanner_database.json';
    this.spaces = options.spaces || 'appDataFolder'; // strict isolation in appDataFolder
    this.fetch = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this.storageKey = options.storageKey || 'dayplanner_gdrive_auth_v1';

    this.accessToken = null;
    this.expiresAt = 0;
    this.profile = null;
    this.fileId = null;

    this.status = {
      state: 'UNAUTHENTICATED', // 'UNAUTHENTICATED' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'OFFLINE'
      lastSyncedAt: null,
      errorMessage: null,
      fileId: null
    };

    this.listeners = new Set();
    this.loadPersistedAuth();
  }

  onStatusChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify() {
    for (const fn of this.listeners) {
      try { fn(this.status, this.profile); } catch {}
    }
  }

  _setStatus(state, errorMessage = null) {
    this.status.state = state;
    this.status.errorMessage = errorMessage;
    if (state === 'SYNCED') {
      this.status.lastSyncedAt = formatSyncTimestamp(new Date());
    }
    this.status.fileId = this.fileId;
    this._notify();
  }

  loadPersistedAuth() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.clientId) this.clientId = parsed.clientId;
        if (parsed.accessToken && parsed.expiresAt > Date.now()) {
          this.accessToken = parsed.accessToken;
          this.expiresAt = parsed.expiresAt;
          this.profile = parsed.profile || null;
          this._setStatus('SYNCED');
        }
      }
    } catch {}
  }

  _persistAuth() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        clientId: this.clientId,
        accessToken: this.accessToken,
        expiresAt: this.expiresAt,
        profile: this.profile
      }));
    } catch {}
  }

  setClientId(clientId) {
    this.clientId = (clientId || '').trim();
    this._persistAuth();
  }

  getClientId() {
    return this.clientId;
  }

  setAuthToken(token, expiresInSeconds = 3600, profile = null) {
    this.accessToken = token;
    this.expiresAt = Date.now() + (expiresInSeconds * 1000);
    if (profile) this.profile = profile;
    this._persistAuth();
    this._setStatus('SYNCED');
  }

  isAuthenticated() {
    return Boolean(this.accessToken && Date.now() < this.expiresAt);
  }

  getProfile() {
    return this.profile;
  }

  getFileId() {
    return this.fileId;
  }

  signOut() {
    this.accessToken = null;
    this.expiresAt = 0;
    this.profile = null;
    this.fileId = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
    this._setStatus('UNAUTHENTICATED');
  }

  /**
   * Browser GIS OAuth Token request
   */
  async requestAccessToken(clientIdOverride) {
    const cid = clientIdOverride || this.clientId;
    if (!cid) {
      throw new Error('ERR_NO_CLIENT_ID: Please provide a Google OAuth Client ID');
    }
    this.setClientId(cid);

    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      throw new Error('ERR_GIS_NOT_LOADED: Google Identity Services library is not loaded');
    }

    return new Promise((resolve, reject) => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (resp) => {
          if (resp.error) {
            this._setStatus('ERROR', resp.error);
            reject(new Error(`ERR_AUTH_FAILED: ${resp.error}`));
            return;
          }

          this.accessToken = resp.access_token;
          this.expiresAt = Date.now() + (parseInt(resp.expires_in, 10) || 3600) * 1000;

          // Fetch profile info
          try {
            const profileRes = await this.fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            if (profileRes.ok) {
              this.profile = await profileRes.json();
            }
          } catch {}

          this._persistAuth();
          this._setStatus('SYNCED');
          resolve(this.accessToken);
        }
      });

      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  /**
   * Find or create the database file in Google Drive appDataFolder
   */
  async ensureFileId() {
    if (this.fileId) return this.fileId;
    if (!this.isAuthenticated()) {
      throw new Error('ERR_UNAUTHENTICATED: Must be signed into Google Drive');
    }

    // 1. Search for existing file
    const query = encodeURIComponent(`name='${this.fileName}' and trashed=false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=${this.spaces}&q=${query}&fields=files(id,name,modifiedTime)`;

    const res = await this.fetch(searchUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.signOut();
        throw new Error('ERR_TOKEN_EXPIRED: Access token expired. Please sign in again.');
      }
      throw new Error(`ERR_DRIVE_API: Search failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.fileId = data.files[0].id;
      return this.fileId;
    }

    // 2. Create new file in appDataFolder if not found
    const metadata = {
      name: this.fileName,
      parents: [this.spaces]
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify([]) +
      closeDelimiter;

    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const createRes = await this.fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!createRes.ok) {
      throw new Error(`ERR_DRIVE_CREATE: Failed creating file on Drive (${createRes.status})`);
    }

    const createData = await createRes.json();
    this.fileId = createData.id;
    return this.fileId;
  }

  /**
   * Pull contents from Google Drive
   */
  async pullFromDrive() {
    const fileId = await this.ensureFileId();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const res = await this.fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });

    if (!res.ok) {
      throw new Error(`ERR_DRIVE_DOWNLOAD: Failed to fetch file from Drive (${res.status})`);
    }

    try {
      const parsed = await res.json();
      return Array.isArray(parsed) ? parsed : (parsed.activities || []);
    } catch {
      return [];
    }
  }

  /**
   * Push contents to Google Drive
   */
  async pushToDrive(activities) {
    const fileId = await this.ensureFileId();
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

    const res = await this.fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(activities)
    });

    if (!res.ok) {
      throw new Error(`ERR_DRIVE_UPLOAD: Failed uploading to Drive (${res.status})`);
    }

    return true;
  }

  /**
   * Full Bi-Directional Synchronize
   */
  async syncNow(localActivities = []) {
    if (!this.isAuthenticated()) {
      this._setStatus('UNAUTHENTICATED');
      return { merged: localActivities, status: this.status };
    }

    this._setStatus('SYNCING');
    try {
      const remote = await this.pullFromDrive();
      const merged = mergeDatasetsByTimestamp(localActivities, remote);
      await this.pushToDrive(merged);
      this._setStatus('SYNCED');
      return { merged, status: this.status };
    } catch (err) {
      this._setStatus('ERROR', err.message);
      throw err;
    }
  }
}
