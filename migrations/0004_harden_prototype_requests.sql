ALTER TABLE prototype_requests ADD COLUMN idempotency_key TEXT;
ALTER TABLE prototype_requests ADD COLUMN ip_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE prototype_requests ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'not_sent';
ALTER TABLE prototype_requests ADD COLUMN notification_error TEXT NOT NULL DEFAULT '';
ALTER TABLE prototype_requests ADD COLUMN notified_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prototype_requests_idempotency
  ON prototype_requests(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_prototype_requests_ip_created
  ON prototype_requests(ip_hash, created_at);
