ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_media_id" integer;
CREATE INDEX IF NOT EXISTS "users_avatar_media" ON "users" ("avatar_media_id");
