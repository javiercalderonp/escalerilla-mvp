import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

// Parse .env manually
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const sql = neon(url);

const steps = [
  {
    name: "enum backhand",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."backhand" AS ENUM('una_mano', 'dos_manos');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: "enum dominant_hand",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."dominant_hand" AS ENUM('diestro', 'zurdo');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: "enum dominant_hand values",
    sql: `DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'dominant_hand'
          AND e.enumlabel = 'derecha'
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'dominant_hand'
          AND e.enumlabel = 'diestro'
      ) THEN
        ALTER TYPE "public"."dominant_hand" RENAME VALUE 'derecha' TO 'diestro';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'dominant_hand'
          AND e.enumlabel = 'zurda'
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'dominant_hand'
          AND e.enumlabel = 'zurdo'
      ) THEN
        ALTER TYPE "public"."dominant_hand" RENAME VALUE 'zurda' TO 'zurdo';
      END IF;
    END $$;`,
  },
  {
    name: "player_status add pendiente",
    sql: `DO $$ BEGIN
      ALTER TYPE "public"."player_status" ADD VALUE IF NOT EXISTS 'pendiente' BEFORE 'activo';
    EXCEPTION WHEN others THEN NULL; END $$;`,
  },
  {
    name: "players.rut column",
    sql: `ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rut" text;`,
  },
  {
    name: "players.dominant_hand column",
    sql: `ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "dominant_hand" "dominant_hand";`,
  },
  {
    name: "players.backhand column",
    sql: `ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "backhand" "backhand";`,
  },
  {
    name: "players_rut_unique constraint",
    sql: `DO $$ BEGIN
      ALTER TABLE "players" ADD CONSTRAINT "players_rut_unique" UNIQUE("rut");
    EXCEPTION WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: "player_schedule_slots table",
    sql: `CREATE TABLE IF NOT EXISTS "player_schedule_slots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE cascade,
      "day_of_week" integer NOT NULL,
      "hour" integer NOT NULL,
      CONSTRAINT "player_schedule_slot_unique" UNIQUE("player_id", "day_of_week", "hour")
    );`,
  },
  {
    name: "player_schedule_slot_player_idx index",
    sql: `CREATE INDEX IF NOT EXISTS "player_schedule_slot_player_idx"
      ON "player_schedule_slots" USING btree ("player_id");`,
  },
];

for (const step of steps) {
  process.stdout.write(`  ${step.name}... `);
  try {
    await sql.query(step.sql);
    console.log("✓");
  } catch (err) {
    console.log(`✗  ${err.message}`);
    process.exit(1);
  }
}

console.log("\nMigración completada.");
