# COMPLETE SOFTWARE REQUIREMENTS & TECHNICAL MANUAL
**Project:** Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management  
**Client Organization:** Oil India Limited (SIH26122)  
**Version:** 2.1.0  

---

## 1. INTRODUCTION

### 1.1 Purpose
This Software Requirements Specification (SRS) and Technical Manual provides a formal, comprehensive description of the software architecture, functional requirements, deployment instructions, and system interfaces for the **Intelligent Data Capture & Schedule-Linking Layer**.

### 1.2 Scope
The software product is a mission-critical, offline-first Progressive Web Application (PWA) integrated with an edge serverless backend (Cloudflare Workers & D1 SQLite). It addresses the operational disconnect between macro-level project planning tools (Primavera P6) and micro-level field actuals (L5/L6 tasks) across high-value capital infrastructure projects of Oil India Limited.

---

## 2. SYSTEM OVERVIEW & ARCHITECTURE

The system is structured as a two-tier decoupled architecture:
1. **Frontend PWA Client:** A zero-dependency, modular Single Page Application (SPA) utilizing HTML5, CSS3, and native ES6 JavaScript modules. Runs client-side with full offline support via Service Workers and IndexedDB.
2. **Edge Backend API (`/worker`):** An edge-serverless REST API running on Cloudflare Workers coupled with Cloudflare D1 (serverless relational SQLite).

### System Topology Diagram
```text
[ FIELD SUPERVISORS (Offline) ]  <---> [ Service Worker & IndexedDB ]
                                                  | (Auto-syncs on connection)
[ LEAD PLANNERS (Online) ]       <---> [ Cloudflare Edge Workers API ]
                                                  |
                                       [ Cloudflare D1 Database & AI Matcher ]
```

---

## 3. FUNCTIONAL REQUIREMENTS

### Module 1: Authentication & Navigation
- Role-restricted views spanning 5 roles (Admin, Executive/GM, Planner, Reviewer, Field Supervisor).
- Route guards to prevent unauthorized access.

### Module 2: Field Data Capture & Voice Processing
- Intuitive field intake form capturing: Project ID, Discipline, Location/Asset, Progress, Units, and Blockers.
- One-click voice recording via Web Speech API, transcribing audio to text.
- Photo evidence capture via device camera.

### Module 3: Offline Engine & Background Synchronization
- Service Worker implements Network-First with Cache Fallback.
- Offline submissions commit to IndexedDB `pendingReports`.
- Background `SyncManager` auto-drains queued reports when network connectivity resumes.

### Module 4: NLP Entity Extraction & Schedule-Linking Engine
- Extracts entities: Discipline, Asset Tag, Work Type, Quantities, Blockers.
- Multi-Signal Match Classifier calculates confidence scores based on fuzzy tag matching, semantic similarity, and schedule window proximity.

### Module 5: Planner Reconciliation
- Dual-pane Review Queue for planners to verify AI-suggested schedule mappings.
- One-click approval updates schedule actuals and calculates variance.

### Module 6: Immutable Audit Trail
- Every mutation creates an immutable audit record with IST timestamp, actor, role, and action detail.

---

## 4. DEPLOYMENT & SETUP INSTRUCTIONS

### Local & Desktop Deployment
1. **Prerequisites:** Python 3.8+ installed.
2. **Launch:** Open the project folder and double-click `deploy-windows.bat`.
3. **PWA Install:** Open `http://localhost:8000/#/login` in Edge/Chrome, click "Install App" in the address bar to run as a native Windows application.

### Cloud Deployment
1. **Frontend (Cloudflare Pages):**
   `npx wrangler pages deploy . --project-name=oil-bridge-pwa`
2. **Backend (Cloudflare Workers + D1):**
   ```bash
   cd worker
   npx wrangler d1 create oil-db
   npx wrangler d1 execute oil-db --file=./schema.sql
   npx wrangler d1 execute oil-db --file=./seed.sql
   npx wrangler deploy
   ```

---

## 5. ALGORITHMIC SPECIFICATIONS

### Explainable Multi-Signal Schedule Matching Algorithm
Calculates a composite score S between field report R and candidate schedule activities A:
`S(R, A) = (0.35 * TagMatch) + (0.25 * DisciplineMatch) + (0.25 * SemanticSim) + (0.15 * WindowProximity)`

### Canvas Fluid Simulation (Landing Page)
Utilizes a coupled Spring-Mass Wave System to simulate viscous petroleum crude, rendering at 60fps using custom HTML5 Canvas quadratic curves.

---

## 6. END-TO-END DATA FLOW
1. **Offline Capture:** Field Supervisor records voice report without internet. Saves to IndexedDB.
2. **Background Sync:** Device detects network. Service Worker pushes report to API.
3. **AI Extraction:** Backend NLP isolates "Foundation B2", "240 m3", "Civil".
4. **Matcher:** AI suggests mapping to Activity `ACT-CIV-B2-003` with 94% confidence.
5. **Reconciliation:** Planner reviews and approves match.
6. **Audit:** System logs event to cryptographic ledger. Executive dashboard updates instantly.
