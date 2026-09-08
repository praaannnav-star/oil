# Collaborator & Developer Onboarding Guide
**Project:** Intelligent Data Capture & Schedule-Linking Layer (SIH26122 - Oil India Limited)

Welcome to the team! This document is your exhaustive guide to understanding the entire codebase, file by file, and how the system architecture flows. This is designed to get any new collaborator up to speed and pushing code on day one.

---

## 1. FULL SYSTEM ARCHITECTURE

This project is an **Offline-First Progressive Web App (PWA)** combined with an **Edge Serverless Backend**. We intentionally use **0% heavy frontend frameworks** (No React, Vue, or Webpack) to ensure ultra-fast load times on rugged field devices with poor connectivity.

### The 4-Tier Architecture
1. **The View/Component Tier (HTML5/Vanilla JS):** Renders UI, handles DOM events, and subscribes to the global `State` object.
2. **The Offline/Sync Tier (Service Worker + IndexedDB):** Intercepts all network requests. If offline, it saves mutations to IndexedDB (`oil-field-db`) and queues them. When online, `SyncManager` flushes the queue to the API.
3. **The Services Tier (`js/services/`):** Houses all business logic (Authentication, NLP Extraction, Schedule Matching, Audit generation).
4. **The Edge API Tier (`worker/`):** Cloudflare Workers (V8 Isolates) + Cloudflare D1 (Serverless SQLite) providing global, low-latency REST endpoints.

---

## 2. DIRECTORY & FILE-BY-FILE BREAKDOWN

### 📁 Root Directory (App Shell & PWA)
* **`index.html`**: The Single-Page Application (SPA) shell. Contains the mounting points (`#main-content`, `#app`), structural CSS links, and imports `js/main.js`. It never reloads.
* **`service-worker.js`**: The PWA network proxy. Implements a **Network-First with Cache Fallback** strategy. Pre-caches the App Shell on install.
* **`manifest.json`**: Standard PWA manifest for Android/Windows installation.
* **`deploy-windows.bat` / `start-server.bat`**: Quick-launch scripts for spinning up a local Python/Node server and launching the app in Native Window mode on Windows.

### 📁 Core Infrastructure (`js/`)
* **`main.js`**: The bootstrap orchestrator. Registers the Service Worker, initializes the Offline/Sync engines, sets up routing paths, and mounts the initial view.
* **`router.js`**: A custom declarative Hash Router (`#/path`). Handles view destruction (preventing memory leaks), validates RBAC (Role-Based Access Control) via `Auth.canAccess()`, and dynamic URL parsing (e.g., `#/activities/:id`).
* **`state.js`**: A reactive Pub/Sub state container. Holds `currentProject`, `currentUser`, and `connectionStatus`. Components `subscribe()` to re-render when state changes.
* **`db.js`**: Promise wrapper around the native browser `IndexedDB`. Manages three object stores: `pendingReports` (offline queue), `drafts` (autosaves), and `cachedData` (for offline reads).
* **`sync.js`**: The Background Sync Engine. Listens to the `window.ononline` event, loops through `db.getPendingReports()`, transmits them to the server, and triggers the AI Matcher.
* **`pwa.js` & `offline.js`**: Manages the PWA update lifecycle (`reg.update()`) and UI network indicators (the yellow offline banner).

### 📁 Services Layer (`js/services/`)
*Contains the core business logic and data access routines.*
* **`api.js`**: The brain of the data layer. Uses `_probeBackend()` to check if the Cloudflare Worker is alive. If yes, it acts as an HTTP client. If no (or offline), it acts as a Local Mock Engine, mutating state in IndexedDB directly. It auto-hydrates seed data if the database is empty.
* **`auth.js`**: Manages the 5 enterprise personas (Admin, Exec, Planner, Reviewer, Field). Handles `sessionStorage` hydration and validates route access.
* **`reports.js`**: Ingests field progress, applies heuristic Regex rules to extract entities (Discipline, Asset Tag, Quantity, Blockers).
* **`speech.js`**: Wraps the browser's `webkitSpeechRecognition` API for voice dictation.
* **`review.js`**: The reconciliation engine. Takes an AI match, applies the field actuals to the Master Schedule, computes variance (Delay in Days), and logs it.
* **`audit.js`**: Appends immutable, cryptographically styled chain-of-custody records to the audit ledger.
* **`projects.js` & `activities.js`**: CRUD operations and hierarchy management for the L1-L6 WBS (Work Breakdown Structure).

### 📁 Views Layer (`js/views/`)
*These are factory functions returning DOM elements, dynamically mounted by `router.js`.*
* **`Login.js`**: The entry point. Mounts the interactive background canvas and 1-click persona buttons.
* **`Overview.js`**: Executive Command Center. Computes portfolio-wide KPIs and displays "What Changed Since Yesterday".
* **`FieldCapture.js`**: The main intake form. Includes voice dictation toggles, photo uploads, and live entity extraction badges.
* **`ReviewQueue.js`**: Dual-pane planner workstation. Compares raw field notes (Left) against AI-suggested schedule nodes (Right) for 1-click approval.
* **`ScheduleExplorer.js`**: A multi-tier Gantt/Tree visualization of the WBS (Levels 1 through 6) with progress bars and variance indicators.
* **`ActivityDetail.js`**: Deep dive into a single node (`#/activities/ACT-CIV-B2`), showing predecessor dependencies and photographic evidence.
* **`AuditTrail.js`**: Renders the vertical chronological timeline of all system events.
* **`ExecutionMemory.js`**: A searchable knowledge base of historical blockers and AI predictive delay warnings.

### 📁 UI Components (`js/components/`)
*Reusable, stateless UI rendering functions.*
* **`CanvasLiquid.js`**: A highly optimized (60fps) physics engine simulating viscous petroleum crude using a Spring-Mass wave equation and Bezier curves. Mounted in `Login.js`.
* **`Timeline.js`**: Renders the vertical dotted timeline used in the Audit view.
* **`Card.js`, `Table.js`, `Modal.js`, `Toast.js`**: Standardized UI shell elements matching the Oil India Limited design system.

### 📁 Backend Worker (`worker/`)
*The Cloudflare Edge API. Deployable via `npx wrangler deploy`.*
* **`src/index.js`**: The Hono/itty-router equivalent for edge routing. Defines `GET /api/activities`, `POST /api/reports`, etc.
* **`schema.sql`**: The Cloudflare D1 relational schema. Defines `projects`, `activities`, `field_reports`, `review_queue`, and `audit_trail` tables.
* **`seed.sql`**: Baseline Duliajan CGGS expansion mock data.
* **`src/prompts.js`**: System prompts used for formatting LLM extraction if hooked into Cloudflare Workers AI.

---

## 3. HOW THE CODE ACTUALLY FLOWS (Example Lifecycle)

To understand how to contribute, you must understand the data lifecycle. Here is exactly what happens when a Field Supervisor submits a report while offline:

1. **User Action:** The supervisor clicks "Submit" in `js/views/FieldCapture.js`.
2. **Intake:** The view calls `API.reports.unshift(data)`.
3. **Offline Trap:** Inside `reports.js`, it checks `navigator.onLine`. Since it's false, it intercepts the payload and passes it to `DB.addPendingReport(data)` in `db.js`.
4. **State Update:** `State.pendingCount` increments. The Header UI reactively updates to show an amber sync badge.
5. **Reconnection:** The supervisor walks into a Wi-Fi zone. The browser fires `window.ononline`.
6. **Sync Engine:** `sync.js` catches the event. It sets `State.connectionStatus = 'syncing'`.
7. **Drain & Process:** It loops through IndexedDB, takes the report, and pushes it through the `API`.
8. **Entity Extraction & Match:** The system extracts "Foundation B2", correlates it to `ACT-CIV-B2-003`, and generates a Review Queue item with a 94% confidence score.
9. **Audit Log:** The system appends an entry to the Audit Trail.
10. **Cleanup:** The pending report is deleted from IndexedDB, the UI sync badge turns green, and a success Toast is fired.

---

## 4. LOCAL DEVELOPMENT WORKFLOW

### Rule 1: No Bundlers Needed
Because this is written in ES Modules (`<script type="module">`), there is no `npm run build` or `npm run dev` necessary for the frontend. 

### Rule 2: Start a Local Server
You **must** run a local HTTP server. Opening `file:///c:/.../index.html` will throw CORS errors for ES Modules and disable Service Workers.
```bash
# In the root folder, run:
python -m http.server 8000
```
Open `http://localhost:8000`. 

### Rule 3: Bypassing the Service Worker Cache
When writing code, the Service Worker will aggressively cache your old JavaScript files. 
* **To see changes immediately:** Open Chrome DevTools (F12) -> Network Tab -> Check **"Disable cache"**.
* **Hard Refresh:** Use `Ctrl + Shift + R`.

### Rule 4: Data Wipes
If you mess up the local database while testing changes:
1. Log in as an Admin.
2. Click the gear icon in the top right.
3. Click **"Reset Demo Data"**. This instantly truncates IndexedDB and reloads the factory arrays from `js/data/mock-*.js`.

Happy coding! If you are touching the views, start in `js/views/`. If you are touching data logic, start in `js/services/api.js`.
