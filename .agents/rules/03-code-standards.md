# Technical Code Standards

```yaml
platforms: [PWA, Android]
storage_paradigm: local-first
offline_resilience: mandatory
```

## 1. Dual-Target Parity
- **Web (PWA)**: Must be fully functional, responsive, installable, and work offline via Service Worker and Cache API / IndexedDB.
- **Android**: Wrapped via Capacitor/Webview or native components; must pass all device API bridge checks.
- **Shared Core**: 100% of business logic, state management, and validation logic must reside in platform-agnostic modules.

## 2. Local-First & Offline Architecture
- Primary data storage resides on client (IndexedDB / SQLite / Encrypted Local Storage).
- Remote sync operates asynchronously in background; network unavailability must never block local UI interactions or data queries.
- Sensitive data (credentials, financial/banking tokens, PII) must never be logged or transmitted in unencrypted formats.

## 3. Tool & Runtime Conventions
- Preferred test runners: Node native test runner (`node --test`), Vitest, or Jest depending on project setup.
- Scaffolding tools: Modular ES modules (`.mjs`) executable via `node`.
- Development servers: Use explicit non-conflicting standard ports (e.g. `localhost:8085` for PersonalAssistant).

