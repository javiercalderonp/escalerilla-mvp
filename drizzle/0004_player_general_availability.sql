ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "avail_monday" boolean,
  ADD COLUMN IF NOT EXISTS "avail_tuesday" boolean,
  ADD COLUMN IF NOT EXISTS "avail_wednesday" boolean,
  ADD COLUMN IF NOT EXISTS "avail_thursday" boolean,
  ADD COLUMN IF NOT EXISTS "avail_friday" boolean,
  ADD COLUMN IF NOT EXISTS "avail_saturday" boolean,
  ADD COLUMN IF NOT EXISTS "avail_sunday" boolean;
