-- Link identified cart snapshots to their anonymous, short-lived analytics session.
-- Existing cart rows remain unchanged and can be populated on their next update.
ALTER TABLE incomplete_carts
  ADD COLUMN IF NOT EXISTS analytics_session_id text;

CREATE INDEX IF NOT EXISTS incomplete_carts_analytics_session
  ON incomplete_carts(analytics_session_id);
