DO $$ BEGIN
 CREATE TYPE "public"."player_level" AS ENUM('principiante', 'intermedio_bajo', 'intermedio_alto', 'avanzado');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."dominant_hand" AS ENUM('diestro', 'zurdo');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."backhand" AS ENUM('una_mano', 'dos_manos');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."play_frequency" AS ENUM('1-2_semana', '3-4_semana', '5+_semana');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "first_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "last_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "birth_date" date;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rut" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "joined_ladder_on" date;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "level" "player_level";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "dominant_hand" "dominant_hand";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "backhand" "backhand";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "years_playing" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "play_frequency" "play_frequency";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "visibility" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_level_idx" ON "players" USING btree ("level");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "players" ADD CONSTRAINT "players_rut_unique" UNIQUE("rut");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
