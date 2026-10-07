-- Stories are additive content records; no existing table or user data is altered.
CREATE TABLE IF NOT EXISTS stories (
  id serial PRIMARY KEY,
  title text NOT NULL,
  caption text,
  media_id integer NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  product_id integer,
  href text,
  cta_label text,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stories_media_type_check CHECK (media_type IN ('image', 'video')),
  CONSTRAINT stories_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT stories_date_range_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS stories_public_order ON stories(status, sort_order, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS story_interactions (
  id serial PRIMARY KEY,
  story_id integer NOT NULL,
  visitor_hash text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  liked boolean NOT NULL DEFAULT false,
  liked_at timestamptz,
  CONSTRAINT story_interactions_story_visitor_unique UNIQUE (story_id, visitor_hash)
);
CREATE INDEX IF NOT EXISTS story_interactions_story_liked ON story_interactions(story_id, liked);
