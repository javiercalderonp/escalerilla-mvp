CREATE TYPE "public"."backhand" AS ENUM('una_mano', 'dos_manos');--> statement-breakpoint
CREATE TYPE "public"."championship_type" AS ENUM('regular', 'clausura', 'especial');--> statement-breakpoint
CREATE TYPE "public"."dominant_hand" AS ENUM('diestro', 'zurdo');--> statement-breakpoint
CREATE TYPE "public"."week_status" AS ENUM('borrador', 'abierta', 'cerrada');--> statement-breakpoint
ALTER TYPE "public"."player_status" ADD VALUE 'pendiente' BEFORE 'activo';--> statement-breakpoint
CREATE TABLE "availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"monday" boolean DEFAULT false NOT NULL,
	"tuesday" boolean DEFAULT false NOT NULL,
	"wednesday" boolean DEFAULT false NOT NULL,
	"thursday" boolean DEFAULT false NOT NULL,
	"friday" boolean DEFAULT false NOT NULL,
	"saturday" boolean DEFAULT false NOT NULL,
	"sunday" boolean DEFAULT false NOT NULL,
	"max_matches" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_week_player_unique" UNIQUE("week_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "championship_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"championship_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "champ_placements_champ_player_unique" UNIQUE("championship_id","player_id"),
	CONSTRAINT "champ_placements_champ_pos_unique" UNIQUE("championship_id","position")
);
--> statement-breakpoint
CREATE TABLE "championships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "gender" NOT NULL,
	"type" "championship_type" DEFAULT 'regular' NOT NULL,
	"played_on" date NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freezes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"reason" text NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"hour" integer NOT NULL,
	CONSTRAINT "player_schedule_slot_unique" UNIQUE("player_id","day_of_week","hour")
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "week_status" DEFAULT 'borrador' NOT NULL,
	"availability_opens_at" timestamp with time zone,
	"availability_closes_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rut" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "dominant_hand" "dominant_hand";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "backhand" "backhand";--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_placements" ADD CONSTRAINT "championship_placements_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_placements" ADD CONSTRAINT "championship_placements_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championships" ADD CONSTRAINT "championships_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championships" ADD CONSTRAINT "championships_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_schedule_slots" ADD CONSTRAINT "player_schedule_slots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_week_idx" ON "availability" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX "availability_player_idx" ON "availability" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "champ_placements_champ_idx" ON "championship_placements" USING btree ("championship_id");--> statement-breakpoint
CREATE INDEX "championships_season_idx" ON "championships" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "championships_category_idx" ON "championships" USING btree ("category");--> statement-breakpoint
CREATE INDEX "freezes_player_idx" ON "freezes" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "freezes_season_idx" ON "freezes" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "player_schedule_slot_player_idx" ON "player_schedule_slots" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "weeks_season_idx" ON "weeks" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "weeks_starts_on_idx" ON "weeks" USING btree ("starts_on");--> statement-breakpoint
CREATE INDEX "weeks_status_idx" ON "weeks" USING btree ("status");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_rut_unique" UNIQUE("rut");
