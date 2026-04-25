import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "player", "guest"]);
export const genderEnum = pgEnum("gender", ["M", "F"]);
export const playerStatusEnum = pgEnum("player_status", [
  "activo",
  "congelado",
  "retirado",
]);
export const seasonStatusEnum = pgEnum("season_status", ["activa", "cerrada"]);
export const rankingEventReasonEnum = pgEnum("ranking_event_reason", [
  "initial_seed",
  "match_win",
  "match_loss_3s",
  "match_loss_2s",
  "match_loss_set_largo",
  "match_draw",
  "wo_win",
  "wo_loss",
  "championship_bonus",
  "inactivity_month",
  "inactivity_3mo",
  "inactivity_6mo",
  "inactivity_1y",
  "manual_adjustment",
  "match_correction",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("guest"),
    playerId: uuid("player_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    playerIdUnique: unique("users_player_id_unique").on(table.playerId),
  }),
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").unique(),
    gender: genderEnum("gender").notNull(),
    status: playerStatusEnum("status").notNull().default("activo"),
    initialPoints: integer("initial_points").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    genderStatusIdx: index("players_gender_status_idx").on(table.gender, table.status),
    emailIdx: index("players_email_idx").on(table.email),
  }),
);

export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  year: integer("year").notNull().unique(),
  status: seasonStatusEnum("status").notNull().default("activa"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rankingEvents = pgTable(
  "ranking_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "restrict" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    delta: integer("delta").notNull(),
    reason: rankingEventReasonEnum("reason").notNull(),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    note: text("note"),
    registeredById: uuid("registered_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    playerIdx: index("ranking_events_player_idx").on(table.playerId),
    occurredAtIdx: index("ranking_events_occurred_at_idx").on(table.occurredAt),
    playerOccurredIdx: index("ranking_events_player_occurred_idx").on(
      table.playerId,
      table.occurredAt,
    ),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    payload: jsonb("payload"),
  },
  (table) => ({
    actorIdx: index("audit_log_actor_idx").on(table.actorId),
    entityIdx: index("audit_log_entity_idx").on(table.entityType, table.entityId),
    occurredAtIdx: index("audit_log_occurred_at_idx").on(table.occurredAt),
  }),
);

