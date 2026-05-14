ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "wants_multiple_matches" boolean NOT NULL DEFAULT false;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "always_available" boolean NOT NULL DEFAULT false;
