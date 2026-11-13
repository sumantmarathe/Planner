/**
 * Global Application Configuration
 */

export const APP_CONFIG = Object.freeze({
  APP_NAME: 'DayPlanner',
  VERSION: '1.0.0',
  // Embedded Google Cloud OAuth 2.0 Web Client ID
  GOOGLE_CLIENT_ID: '346635727868-1sso4ndlabrdaptga1aqr8prr7s0gu76.apps.googleusercontent.com',
  // Isolated Application Data folder on user's Google Drive
  DRIVE_SPACES: 'appDataFolder',
  DRIVE_FILE_NAME: 'dayplanner_database.json',
  DRIVE_SCOPES: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
});
