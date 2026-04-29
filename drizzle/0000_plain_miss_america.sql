DO $$ BEGIN
 CREATE TYPE "public"."match_format" AS ENUM('mr3', 'set_largo');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."match_status" AS ENUM('pendiente', 'reportado', 'confirmado', 'wo', 'empate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."match_type" AS ENUM('sorteo', 'desafio', 'campeonato');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"games_p1" integer NOT NULL,
	"games_p2" integer NOT NULL,
	"tiebreak_p1" integer,
	"tiebreak_p2" integer,
	CONSTRAINT "match_sets_match_set_unique" UNIQUE("match_id","set_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid,
	"category" "gender" NOT NULL,
	"type" "match_type" NOT NULL,
	"player1_id" uuid NOT NULL,
	"player2_id" uuid NOT NULL,
	"played_on" date,
	"status" "match_status" DEFAULT 'pendiente' NOT NULL,
	"format" "match_format",
	"winner_id" uuid,
	"wo_loser_id" uuid,
	"reported_by_id" uuid,
	"confirmed_by_id" uuid,
	"reported_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_wo_loser_id_players_id_fk" FOREIGN KEY ("wo_loser_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_week_idx" ON "matches" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_player1_idx" ON "matches" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_player2_idx" ON "matches" USING btree ("player2_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_played_on_idx" ON "matches" USING btree ("played_on");--> statement-breakpoint
