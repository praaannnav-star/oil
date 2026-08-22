# Oil India Limited — Deployment Guide (SIH26122)

Current state: **fully functional offline-first PWA running on mock data** (`API.useMock = true`).
All domain data persists locally in IndexedDB; every workflow (capture → extract → match →
review → reconcile → audit, surveys, evidence) works with zero backend.

This guide covers: local/Windows deployment, static cloud hosting, the smoke test,
and the roadmap for wiring the Cloudflare Workers backend.

---

## 1. Run Locally / on Windows

### Method A: One-Click Launcher
1. Open the project folder.
2. Double-click **`deploy-windows.bat`** (or `start-server.bat`).
3. The script detects Python or Node.js, serves on port 8000 and opens `http://localhost:8000`.

> HTTPS is required for service-worker install on non-localhost origins. Use Cloudflare Pages below for a public URL.

### Method B: Install as a Windows App (PWA)
1. Open the app in Edge or Chrome.
2. Click **Install App** in the address bar (or the Install button in-app).
3. Runs in its own window, pinned to Taskbar, fully offline-capable.

### Verify before any demo: run the smoke test

```bash
node scripts/smoke.mjs http://localhost:8000
```

Checks that **every asset precached by the service worker** actually resolves with a
correct content type (catches SW cache drift — the classic cause of broken offline
installs) plus manifest icons. Exit code 0 = demo-safe. Wire this into CI:

```yaml
# GitHub Actions sketch
- run: python -m http.server 8000 &
- run: node scripts/smoke.mjs http://localhost:8000
```

### Demo reset
Admin header → **Reset Demo Data** restores factory seed state (RAM + IndexedDB).

---

## 2. Static Cloud Hosting

The PWA is pure static files — any of these work as-is:

```bash
# Cloudflare Pages (recommended — same platform as the future Workers API)
npx wrangler pages deploy . --project-name=oil-india-bridge

# Vercel
npx vercel --prod

# Netlify
npx netlify deploy --prod --dir=.
```

---

## 3. Authentication & Demo Personas

| Role | Username | Password | Key Permissions |
|---|---|---|---|
| **System Admin** | `admin` | `password123` | All views, review actions, user roles |
| **Executive / GM** | `executive` | `password123` | Overview KPIs, Project Details, Analytics, Delay Memory |
| **Project Manager** | `manager` | `password123` | Project CRUD, Review Queue, Surveys |
| **Project Planner** | `planner` | `password123` | Schedule Explorer (L1–L6), Review Queue approvals/rejections |
| **QA / Reviewer** | `reviewer` | `password123` | Review Queue, Evidence verification, Surveys, Audit logs |
| **Field Supervisor** | `supervisor` | `password123` | Voice Field Capture, Surveys, Offline Drafts |

Review actions are session-bound: approvals/rejections are attributed to whoever is
signed in and rejected for roles without permission. Demo credentials must be replaced
by real auth before production (see roadmap).

---

## 4. Backend Roadmap (Workers + D1 + Cloudinary + Workers AI)

The client already talks to an abstraction layer (`js/services/api.js`). Going live means
flipping `useMock = false` and implementing these Worker routes — no view rewrites needed:

| Route | Purpose | Notes |
|---|---|---|
| `POST /api/transcribe` | Field voice notes → text | Workers AI `@cf/openai/whisper`, en-IN prompt hint (fallback path already coded in `js/services/speech.js`) |
| `POST /api/summarize` | Daily digest text | Replaces rules-based `summarizeDailyDigest` |
| `POST /api/delay-cause` | Blocker text → cause enum | Feeds ExecutionMemory from live LLM classification |
| `GET/POST /api/projects|activities|reports|surveys|evidence|review` | Domain CRUD | Mirror existing service method shapes |
| `/api/audit/verify` | Hash-chain verification | Acceptance A7 |

### D1 migration sketch (first iteration)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE,
  location TEXT, project_type TEXT, category TEXT, risk_tier TEXT,
  priority TEXT, region TEXT, lat REAL, lng REAL,
  start_date TEXT, target_finish TEXT, health TEXT, spi REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE activities (
  id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id),
  parent_id TEXT, level TEXT, code TEXT, name TEXT, discipline TEXT,
  planned_start TEXT, planned_finish TEXT, actual_start TEXT, actual_finish TEXT,
  progress REAL, status TEXT, variance REAL
);
CREATE TABLE reports (
  id TEXT PRIMARY KEY, project_id TEXT, author TEXT,
  raw_transcript TEXT, extracted_json TEXT, matched_activity_id TEXT,
  confidence INTEGER, status TEXT, reviewer TEXT, reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE evidence (
  id TEXT PRIMARY KEY, report_id TEXT, activity_id TEXT, project_id TEXT,
  url TEXT, filename TEXT, uploaded_by TEXT, status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE surveys (
  id TEXT PRIMARY KEY, project_id TEXT, template_id TEXT,
  submitted_by TEXT, answers_json TEXT, geo_json TEXT,
  status TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE audit_logs (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, activity_id TEXT,
  action TEXT, actor TEXT, role TEXT, detail TEXT,
  prev_hash TEXT, hash TEXT, created_at TEXT DEFAULT (datetime('now'))
);
```

Cron trigger (`wrangler.toml`): nightly reconciliation digest job — verify audit chain,
refresh materialized KPIs, email exception summary.

### Image pipeline (Cloudinary)
Field photos currently persist as data URLs in IndexedDB (works offline). When live:
upload via signed Cloudinary preset from the Worker, store the returned URL in
`evidence.url`. The offline queue already carries binary-safe payloads through sync.

### Rollback drill
1. Static frontend: redeploy previous Pages deployment (`wrangler pages deployment list` → promote prior). Service worker cache name bumps (`oil-tracker-vN`) guarantee clients pick up clean state.
2. Backend: Workers versions allow instant traffic rollback (`wrangler versions rollback`); D1 point-in-time restore covers data.
3. Kill-switch: set `useMock = true` in deployed `api.js` to fall back to standalone PWA mode at any time.

---

## 5. Known Phase-A Limitations
- Map embeds require connectivity (OpenStreetMap iframe); offline shows fallback card.
- Server ASR/transcribe path activates only when a live `/api/transcribe` exists.
- Activity-level map pins need per-activity coordinates (schema ready in D1 sketch).
