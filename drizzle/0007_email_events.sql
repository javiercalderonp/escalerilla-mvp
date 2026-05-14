DO $$ BEGIN
  CREATE TYPE "email_event_type" AS ENUM (
    'availability_reminder',
    'fixture_published',
    'match_result',
    'welcome',
    'inactivity_warning',
    'challenge'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "email_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" "email_event_type" NOT NULL,
  "dedupe_key" text NOT NULL,
  "player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL,
  "recipient_email" text NOT NULL,
  "entity_type" text,
  "entity_id" uuid,
  "status" text DEFAULT 'pending' NOT NULL,
  "error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_events_dedupe_key_unique" UNIQUE("dedupe_key")
);

CREATE INDEX IF NOT EXISTS "email_events_type_idx" ON "email_events" ("type");
CREATE INDEX IF NOT EXISTS "email_events_player_type_idx" ON "email_events" ("player_id", "type");
CREATE INDEX IF NOT EXISTS "email_events_entity_idx" ON "email_events" ("entity_type", "entity_id");
