CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  ip_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
