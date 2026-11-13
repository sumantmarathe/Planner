---
id: SPEC-002
title: Google Drive Confidential User Storage & Sync Engine
status: LOCKED
owner_mode: architect
target_platforms: [PWA, Android]
offline_capable: true
invariants:
  - strict_user_confidentiality
  - google_drive_appdata_isolation
  - local_first_offline_queue
  - zero_server_infrastructure
---

# Specification: Google Drive Confidential User Storage & Sync Engine

## 1. Functional Requirements

- **FR-01 (Google Identity & Authentication)**:
  - Integration with Google Identity Services (GIS OAuth 2.0 token client).
  - Scope: `https://www.googleapis.com/auth/drive.appdata` (isolated confidential application space) and `https://www.googleapis.com/auth/drive.file`.
  - Configurable Google OAuth Client ID via UI settings with persistent client storage and default fallback support.
  - User profile indicator showing active Google account identity, avatar/initials, and Sign In / Sign Out actions.

- **FR-02 (Strict Google Drive Storage & Isolation)**:
  - Storage target: `dayplanner_database.json` located securely inside user's private Google Drive Application Data folder (`appDataFolder`) or designated Drive directory.
  - Confidentiality: No intermediary server or third-party database. All transactions flow strictly between the client device and Google Drive REST API v3 (`https://www.googleapis.com/drive/v3/files`).

- **FR-03 (Bi-Directional Sync & Conflict Resolution)**:
  - On Sign-In / App Load: Automatically discover existing database on Google Drive. If present, pull and merge changes using timestamp resolution (`updatedAt`).
  - On Data Mutation (Create, Update, Toggle, Delete): Staged locally in local cache, then asynchronously synced to Google Drive (debounced 1.5s to conserve API quotas).
  - Manual Sync: "Sync Now" button providing instant bi-directional pull & push.
  - Visual Sync Status indicator: `Synced to Google Drive` (Green), `Syncing...` (Amber), `Offline (Queued)` (Slate), `Sign-in Required` (Blue).

- **FR-04 (Offline Resilience & Queue)**:
  - When offline or unauthenticated, local operations remain non-blocking (local-first cache).
  - Pending modifications are flagged and pushed immediately upon network reconnection or re-authentication.

## 2. Interface Contracts

```typescript
export interface GoogleAuthProfile {
  email?: string;
  name?: string;
  picture?: string;
  accessToken: string | null;
  expiresAt: number; // Unix epoch ms
}

export interface GoogleDriveSyncStatus {
  state: 'UNAUTHENTICATED' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'OFFLINE';
  lastSyncedAt: string | null;
  errorMessage?: string;
  fileId?: string;
}

export interface GoogleDriveAdapterOptions {
  clientId?: string;
  fileName?: string;
  spaces?: 'appDataFolder' | 'drive';
}

export interface GoogleDriveSyncEngine {
  init(): Promise<void>;
  signIn(): Promise<GoogleAuthProfile>;
  signOut(): Promise<void>;
  isAuthenticated(): boolean;
  getProfile(): GoogleAuthProfile | null;
  getStatus(): GoogleDriveSyncStatus;
  syncNow(localData: unknown[]): Promise<{ merged: unknown[]; status: GoogleDriveSyncStatus }>;
  pushToDrive(data: unknown[]): Promise<boolean>;
  pullFromDrive(): Promise<unknown[] | null>;
}
```

## 3. Boundary & Error Conditions

| Condition | Expected Behavior | Error Code / Handling |
| :--- | :--- | :--- |
| OAuth popup blocked / cancelled | Show prompt to user with retry button | `ERR_AUTH_CANCELLED` |
| Token expired (401 from Google API) | Prompt silent token refresh or user re-auth | `ERR_TOKEN_EXPIRED` |
| File does not exist on Drive | Create new `dayplanner_database.json` in `appDataFolder` | `DRIVE_FILE_CREATED` |
| Network offline | Maintain local changes, mark status `OFFLINE`, queue sync | `ERR_NETWORK_OFFLINE` |
| Quota limit exceeded on Drive API | Backoff exponentially, alert user | `ERR_DRIVE_QUOTA` |

