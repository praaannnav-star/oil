-- OIL Bridge API — D1 schema (SIH26122)
-- Mirrors the client-side entity shapes in js/data/mock-*.js and
-- UI_REDESIGN_PLAN.txt §11. Extra/derived client fields ride in extras_json.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  title         TEXT,
  role          TEXT NOT NULL,
  department    TEXT,
  avatar        TEXT,
  allowed_routes_json TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,              -- opaque rotating refresh token
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  code         TEXT UNIQUE,
  name         TEXT NOT NULL,
  location     TEXT,
  project_type TEXT,
  category     TEXT,
  risk_tier    TEXT,
  priority     TEXT,
  region       TEXT,
  lat          REAL,
  lng          REAL,
  start_date   TEXT,
  target_finish TEXT,
  health       TEXT,
  spi          REAL,
  planned_progress  REAL,
  actual_progress   REAL,
  variance     REAL,
  delayed_activities_count INTEGER,
  pending_review_count     INTEGER,
  evidence_coverage        REAL,
  extras_json TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id),
  parent_id      TEXT,
  level          TEXT,
  code           TEXT,
  name           TEXT,
  discipline     TEXT,
  planned_start  TEXT,
  planned_finish TEXT,
  actual_start   TEXT,
  actual_finish  TEXT,
  progress       REAL,
  status         TEXT,
  variance       REAL,
  lat            REAL,
  lng            REAL,
  extras_json    TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);

CREATE TABLE IF NOT EXISTS field_reports (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT,
  author                TEXT,
  raw_transcript        TEXT,
  extracted_json        TEXT,
  matched_activity_id   TEXT,
  matched_activity_name TEXT,
  matched_activity_code TEXT,
  confidence            INTEGER,
  signals_json          TEXT,
  alternatives_json     TEXT,
  status                TEXT NOT NULL DEFAULT 'pending-review',
  source                TEXT,               -- 'llm' | 'rules' | 'offline-sync'
  reviewer              TEXT,
  reviewed_at           TEXT,
  evidence_ids_json     TEXT,
  synced_at             TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_project ON field_reports(project_id);

-- Provenance triples per LLM-touched extraction field (plan §8)
CREATE TABLE IF NOT EXISTS extractions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL REFERENCES field_reports(id),
  field      TEXT NOT NULL,
  value      TEXT,
  source     TEXT NOT NULL,                 -- 'llm' | 'rules' | 'user'
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_extractions_report ON extractions(report_id);

CREATE TABLE IF NOT EXISTS matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id     TEXT NOT NULL REFERENCES field_reports(id),
  activity_id   TEXT,
  confidence    REAL,
  signals_json  TEXT,
  chosen        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id                  TEXT PRIMARY KEY,
  report_id           TEXT,
  type                TEXT NOT NULL DEFAULT 'report',   -- 'report' | 'survey'
  source              TEXT,
  reporter            TEXT,
  discipline          TEXT,
  extracted_json      TEXT,
  top_match_json      TEXT,
  alternatives_json   TEXT,
  survey_answers_json TEXT,
  state               TEXT NOT NULL DEFAULT 'needs-review',
  tab_category        TEXT NOT NULL DEFAULT 'needs-review',
  reviewer            TEXT,
  reviewed_at         TEXT,
  rejection_reason    TEXT,
  age                 TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_state ON reviews(state);

CREATE TABLE IF NOT EXISTS survey_templates (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  sections_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS surveys (
  id            TEXT PRIMARY KEY,
  project_id    TEXT,
  template_id   TEXT,
  template_name TEXT,
  submitted_by  TEXT,
  answers_json  TEXT NOT NULL DEFAULT '{}',
  photos_json   TEXT,
  photo_count   INTEGER NOT NULL DEFAULT 0,
  geo_json      TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted',
  synced_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_surveys_project ON surveys(project_id);

CREATE TABLE IF NOT EXISTS evidence (
  id           TEXT PRIMARY KEY,
  report_id    TEXT,
  activity_id  TEXT,
  activity_name TEXT,
  project_id   TEXT,
  url          TEXT,
  public_id    TEXT,
  type         TEXT,
  filename     TEXT,
  location_meta TEXT,
  uploaded_by  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evidence_activity ON evidence(activity_id);

-- Tamper-evident hash chain: hash = sha256(prev_hash || payload_hash)
CREATE TABLE IF NOT EXISTS audit_events (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT NOT NULL,
  activity_id  TEXT,
  action       TEXT NOT NULL,
  actor        TEXT,
  role         TEXT,
  detail       TEXT,
  prev_hash    TEXT,
  payload_hash TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stats_cache (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OIL Site Location Gazetteer (Phase W3 Mapping Intelligence)
CREATE TABLE IF NOT EXISTS sites (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  lat          REAL NOT NULL,
  lng          REAL NOT NULL,
  project_id   TEXT,
  chainage_ref TEXT,
  facility_type TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);

-- Seed authoritative Oil India project locations & pads
INSERT OR IGNORE INTO sites (id, name, lat, lng, project_id, chainage_ref, facility_type) VALUES
  ('SITE-OIL-DUL-01', 'Duliajan Field Headquarters', 27.3569, 95.3194, 'PRJ-OIL-DUL-001', 'Duliajan HQ', 'Operations Hub'),
  ('SITE-OIL-CTF-01', 'Central Tank Farm, Duliajan', 27.3499, 95.3207, 'PRJ-OIL-DUL-001', 'CTF Duliajan', 'Tank Farm'),
  ('SITE-OIL-DUL-2026-01', 'Duliajan CGGS Main Complex', 27.3569, 95.3194, 'PRJ-OIL-2026-01', 'CH:0+000', 'Plant'),
  ('SITE-OIL-DUL-PAD14', 'Duliajan CGGS Pad 14 (Foundation B2)', 27.3612, 95.3241, 'PRJ-OIL-2026-01', 'Pad 14', 'Drill Pad'),
  ('SITE-OIL-DUL-PAD08', 'Duliajan CGGS Pad 08 (Substation Area)', 27.3521, 95.3125, 'PRJ-OIL-2026-01', 'Pad 08', 'Drill Pad'),
  ('SITE-OIL-NUM-01', 'Numaligarh Dispatch Terminal', 26.6025, 93.7548, 'PRJ-OIL-NUM-002', 'NDT', 'Terminal'),
  ('SITE-OIL-NSPL-01', 'Numaligarh-Siliguri Product Pipeline Corridor', 26.6842, 93.8912, 'PRJ-OIL-NUM-002', 'NSPL Corridor', 'Pipeline'),
  ('SITE-OIL-SIL-01', 'Siliguri Receiving Station', 26.7271, 88.3953, 'PRJ-OIL-NUM-002', 'Siliguri Terminal', 'Terminal');


-- AI Golden Set Benchmark Data (Phase W4 Quality & Tuning Loop)
CREATE TABLE IF NOT EXISTS golden_set (
  id            TEXT PRIMARY KEY,
  transcript    TEXT NOT NULL,
  expected_json TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'benchmark',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO golden_set (id, transcript, expected_json, source) VALUES
  ('GOLD-01', 'Poured 45 cubic meters of concrete for compressor foundation B2 today at Pad 14. Work is completed on schedule.', '{"discipline":"Civil","status":"Completed","blocker":"None"}', 'benchmark'),
  ('GOLD-02', 'Completed hydrostatic testing on 16 inch suction header spool J-44 with zero pressure drops over 4 hours.', '{"discipline":"Piping","status":"Completed","blocker":"None"}', 'benchmark'),
  ('GOLD-03', 'Work on JB-102 cable pulling is delayed due to shortage of flameproof double compression glands from Guwahati store.', '{"discipline":"Instrumentation","status":"Delayed","blocker":"Shortage of flameproof cable glands"}', 'benchmark'),
  ('GOLD-04', 'Continuous heavy monsoon rain has halted all trenching along chainage 42+500 for the gas feeder line.', '{"discipline":"Piping","status":"Delayed","blocker":"Weather / rainfall interruption"}', 'benchmark'),
  ('GOLD-05', 'Completed HT switchgear panel termination and continuity checks at main substation switchyard.', '{"discipline":"Electrical","status":"Completed","blocker":"None"}', 'benchmark'),
  ('GOLD-06', 'Excavation for flare knock-out drum foundation is in progress. Subsoil water ingress requires dewatering pump.', '{"discipline":"Civil","status":"In Progress","blocker":"None"}', 'benchmark');
