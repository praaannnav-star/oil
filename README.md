# Oil India Limited — Field to Schedule Bridge (SIH26122)

> **Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management: Real-Time Actual Progress Tracking**
> 
> **Organization:** Oil India Limited  
> **Theme:** Smart Automation  
> **Category:** Software  
> **Problem Statement ID:** SIH26122

---

## 🚀 Live Deployment

The application is currently deployed and live on Cloudflare.

- **Web Application (PWA):** [https://master.oil-bridge-pwa.pages.dev](https://master.oil-bridge-pwa.pages.dev)
- **Backend API:** [https://oil-bridge-api.praaannnav.workers.dev/api](https://oil-bridge-api.praaannnav.workers.dev/api)

*Note: Use the "1-Click Persona Login" cards on the landing page to instantly test different role-based views without needing a password.*

---

## 🏗️ Overview & Architecture

This application bridges the critical operational gap between **L5/L6 project schedules** and **real-time field progress**.

```text
Field Input (Voice/Text/Photos)
    ↓
AI Entity Extraction (Discipline, Activity, Volume, Dates)
    ↓
Schedule Linking & L5/L6 Matcher (Confidence Scoring & Explainability)
    ↓
Human Planner Validation (Review Queue & Drawer)
    ↓
Schedule Reconciliation & Deviation Detection (Variance, Cause & Corrective Actions)
    ↓
Tamper-Evident Audit Trail & Cross-Project Analytics
```

### Key Technical Pillars
- **Zero-Dependency Architecture**: Built entirely with Vanilla HTML5, CSS3 (Custom Properties), and modern ES Modules.
- **True PWA & Offline First**: IndexedDB (`oil-field-db`) local persistence, Service Worker caching, and background synchronization.
- **Oil India Limited Brand System**: Clean, high-contrast industrial UI styled with official Oil India branding (Red `#E0291D`, Black `#111827`, White `#F9FAFB`).
- **Explainable AI Matching**: Displays confidence gauges with deterministic signal badges (*Why this match?*).

---

## 🚀 How to Run Locally

Because Progressive Web Apps and Service Workers require an HTTP/HTTPS origin, serve the directory with any local static HTTP server:

### Option 1: Python (Recommended)
```bash
python -m http.server 8000
```
Open **http://localhost:8000** in Google Chrome or Microsoft Edge.

### Option 2: Node.js / npx
```bash
npx serve . -p 8000
```

### Option 3: Quick Launch Script (Windows)
Double-click `start-server.bat` in the project root.

---

## 📱 Features & Screen Tour

1. **Executive Overview (`#/overview`)**:
   - Portfolio KPIs (Active projects, delayed milestones, review backlog, evidence coverage).
   - "What changed since yesterday?" situational awareness briefing.
   - Cross-project health and active deviation tracker.

2. **Schedule Explorer (`#/schedule`)**:
   - Multi-tier Work Breakdown Structure navigation (L1 → L6).
   - Planned vs. Actual progress tracking with SPI metrics.
   - Filter by discipline, status, and search keywords.

3. **Field Capture (`#/progress/new`)**:
   - One-touch voice capture (Web Speech API) and structured text input.
   - Real-time extraction of discipline, activity, status, and quantities.
   - Pre-loaded one-click jury demo scenario (`Foundation B2 Pouring`).
   - Camera/photo evidence upload with offline draft saving.

4. **Review Queue (`#/review`)**:
   - Tabbed queue (High Confidence, Needs Review, Ambiguous, Unmatched).
   - Inspector drawer with candidate matching, explainability signals, and instant schedule reconciliation.

5. **Activity Detail (`#/activities/:id`)**:
   - Deep-dive tabs: Overview, Evidence Gallery, Review History, Deviations & Corrective Actions, and Audit Trail.

6. **Intelligence & Memory (`#/analytics`, `#/memory`, `#/audit`)**:
   - Planned vs Actual visual trend charts and milestone timelines.
   - Historical duration variance analysis and recurring delay patterns.
   - Tamper-evident, chronological change log.

---

## 🎯 2-Minute Jury Demonstration Script (Section 37)

1. Open **http://localhost:8000** in Chrome.
2. Click **"Report Progress"** (or tap the bottom microphone button on mobile).
3. Click **"Load Demo Scenario (Foundation B2)"** to simulate field reporting:
   > *"Foundation B2 concreting completed today. Started at 8:30 AM and finished final pour at 5:15 PM with 240 m3 of M40 grade concrete."*
4. Observe the extracted fields and the top recommended schedule link:
   - **Matched Activity**: `CIV-B2-003: Foundation B2 Concrete Pouring & Testing`
   - **Confidence**: `94% HIGH`
   - **Signals**: Discipline match, Asset tag B2 match, Active schedule window.
5. Click **"Submit for Review"**.
6. Switch to the **Review Queue** (`#/review`), select the new report, and click **"Approve & Reconcile Schedule"**.
7. Navigate to **Schedule Explorer** (`#/schedule`) or **Activity Detail** to see actuals updated, variance calculated (+2 days), and corrective actions logged.
8. View **Executive Overview** (`#/overview`) to see updated portfolio metrics.
# oil
