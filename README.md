# DayPlanner

A high-assurance, premium day planner and activity calendar designed for dual-target deployment:
1. **PC Web App (GitHub Pages)**: Zero-server static PWA with 100% offline support.
2. **Android App (Google Play Console)**: Native-grade wrapper powered by Capacitor and Android WebView.

---

## Key Features

- **Specific Activity Planning**: Schedule daily activities with Title, Description, Date, Start/End times, Priority level, and Categories.
- **Multiple Views**:
  - **Day View**: Focused timeline and list for the selected day with quick checklists.
  - **Week View**: 7-day responsive multi-column calendar with activity chips and quick-add.
  - **Month View**: Full monthly grid with activity counts and priority badges.
  - **Tasks View (Unticked Backlog)**: Dedicated backlog showing all incomplete activities segmented into **Overdue**, **Today**, and **Upcoming**, sorted by priority.
- **Priority System**: 4 distinct visual priority levels:
  - `P1 - Urgent` (Crimson Red)
  - `P2 - High` (Amber Orange)
  - `P3 - Medium` (Cobalt Blue)
  - `P4 - Low` (Slate Gray)
- **Checkmark & Completion Flow**: Interactive checkmarks with smooth completion animations that instantly update the task backlog and calendar states.
- **Local-First & Offline Resilience**: Automatic IndexedDB persistence with LocalStorage fallback, offline service worker (`sw.js`), and one-click JSON backup export/restore.
- **Keyboard Shortcuts**:
  - `N`: Plan new activity
  - `1`, `2`, `3`, `4`: Switch between Day, Week, Month, and Tasks views
  - `Esc`: Close open modals

---

## Deployment Instructions

### 1. Deploying to GitHub Pages (PC / Web)
1. Push this repository to GitHub on branch `main`.
2. In your GitHub repository settings, go to **Settings > Pages > Build and deployment > Source**, select **GitHub Actions**.
3. The included workflow `.github/workflows/deploy.yml` automatically executes the test suite and deploys the static application to `https://<username>.github.io/<repo>/`.

### 2. Deploying to Google Play Console (Android)
1. Ensure Node.js and the Android SDK / Android Studio are installed.
2. Run the asset sync script:
   ```bash
   npm run build:android
   ```
3. Initialize or sync with Capacitor (or open the `android` folder directly in Android Studio):
   ```bash
   npx cap add android
   npx cap sync android
   ```
4. Build the release App Bundle (`.aab`) ready for upload to Google Play Console:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   The signed `.aab` file located in `android/app/build/outputs/bundle/release/` can be directly uploaded to your Google Play Console release track.

---

## Verification & Testing

Execute the automated test suite:
```bash
npm test
```

