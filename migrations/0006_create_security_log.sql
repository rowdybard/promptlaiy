CREATE TABLE IF NOT EXISTS security_log (
  id TEXT PRIMARY KEY,
  ip_hash TEXT,
  path TEXT,
  reason TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_log_created ON security_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_log_ip ON security_log(ip_hash);
