CREATE TABLE IF NOT EXISTS prototype_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  idea TEXT NOT NULL,
  audience TEXT NOT NULL,
  problem TEXT NOT NULL,
  alternative TEXT NOT NULL,
  urgency TEXT NOT NULL,
  smallest_version TEXT NOT NULL,
  package_choice TEXT NOT NULL DEFAULT 'prototype',
  hosting_interest INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prototype_requests_created_at
  ON prototype_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prototype_requests_status
  ON prototype_requests(status, created_at DESC);
