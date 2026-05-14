ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "wants_to_play_next_week" boolean NOT NULL DEFAULT false;
