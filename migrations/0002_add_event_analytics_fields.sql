ALTER TABLE product_events ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE product_events ADD COLUMN page_path TEXT NOT NULL DEFAULT '';
ALTER TABLE product_events ADD COLUMN referrer TEXT NOT NULL DEFAULT '';
ALTER TABLE product_events ADD COLUMN user_agent TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_product_events_event_name_created_at
  ON product_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_page_path_created_at
  ON product_events (page_path, created_at DESC);
