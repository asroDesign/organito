CREATE TABLE IF NOT EXISTS home_builder_state (
  id integer PRIMARY KEY,
  draft jsonb NOT NULL,
  revisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
