CREATE TYPE "public"."play_frequency" AS ENUM('1-2_semana', '3-4_semana', '5+_semana');--> statement-breakpoint
CREATE TYPE "public"."player_level" AS ENUM('principiante', 'intermedio_bajo', 'intermedio_alto', 'avanzado');--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "joined_ladder_on" date;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "level" "player_level";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "years_playing" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "play_frequency" "play_frequency";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "visibility" jsonb;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "best_ranking_position" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "best_ranking_achieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
CREATE INDEX "players_level_idx" ON "players" USING btree ("level");