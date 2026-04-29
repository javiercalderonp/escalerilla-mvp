import {
  boolean,
  date,
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
export const weekStatusEnum = pgEnum("week_status", [
  "borrador",
  "abierta",
  "cerrada",
]);
export const matchTypeEnum = pgEnum("match_type", [
  "sorteo",
  "desafio",
  "campeonato",
]);
export const championshipTypeEnum = pgEnum("championship_type", [
  "regular",
  "clausura",
  "especial",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "pendiente",
  "reportado",
  "confirmado",
  "wo",
  "empate",
]);
export const matchFormatEnum = pgEnum("match_format", ["mr3", "set_largo"]);
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    genderStatusIdx: index("players_gender_status_idx").on(
      table.gender,
      table.status,
    ),
    emailIdx: index("players_email_idx").on(table.email),
  }),
);

export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  year: integer("year").notNull().unique(),
  status: seasonStatusEnum("status").notNull().default("activa"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const weeks = pgTable(
  "weeks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: weekStatusEnum("status").notNull().default("borrador"),
    availabilityOpensAt: timestamp("availability_opens_at", {
      withTimezone: true,
    }),
    availabilityClosesAt: timestamp("availability_closes_at", {
      withTimezone: true,
    }),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    seasonIdx: index("weeks_season_idx").on(table.seasonId),
    startsOnIdx: index("weeks_starts_on_idx").on(table.startsOn),
    statusIdx: index("weeks_status_idx").on(table.status),
  }),
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    weekId: uuid("week_id").references(() => weeks.id, { onDelete: "set null" }),
    category: genderEnum("category").notNull(),
    type: matchTypeEnum("type").notNull(),
    player1Id: uuid("player1_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    player2Id: uuid("player2_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    playedOn: date("played_on"),
    status: matchStatusEnum("status").notNull().default("pendiente"),
    format: matchFormatEnum("format"),
    winnerId: uuid("winner_id").references(() => players.id, {
      onDelete: "set null",
    }),
    woLoserId: uuid("wo_loser_id").references(() => players.id, {
      onDelete: "set null",
    }),
    reportedById: uuid("reported_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedById: uuid("confirmed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reportedAt: timestamp("reported_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    weekIdx: index("matches_week_idx").on(table.weekId),
    statusIdx: index("matches_status_idx").on(table.status),
    player1Idx: index("matches_player1_idx").on(table.player1Id),
    player2Idx: index("matches_player2_idx").on(table.player2Id),
    playedOnIdx: index("matches_played_on_idx").on(table.playedOn),
  }),
);

export const matchSets = pgTable(
  "match_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    gamesP1: integer("games_p1").notNull(),
    gamesP2: integer("games_p2").notNull(),
    tiebreakP1: integer("tiebreak_p1"),
    tiebreakP2: integer("tiebreak_p2"),
  },
  (table) => ({
    matchSetUnique: unique("match_sets_match_set_unique").on(
      table.matchId,
      table.setNumber,
    ),
  }),
);

export const availability = pgTable(
  "availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    weekId: uuid("week_id")
      .notNull()
      .references(() => weeks.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    monday: boolean("monday").notNull().default(false),
    tuesday: boolean("tuesday").notNull().default(false),
    wednesday: boolean("wednesday").notNull().default(false),
    thursday: boolean("thursday").notNull().default(false),
    friday: boolean("friday").notNull().default(false),
    saturday: boolean("saturday").notNull().default(false),
    sunday: boolean("sunday").notNull().default(false),
    maxMatches: integer("max_matches").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    weekPlayerUnique: unique("availability_week_player_unique").on(
      table.weekId,
      table.playerId,
    ),
    weekIdx: index("availability_week_idx").on(table.weekId),
    playerIdx: index("availability_player_idx").on(table.playerId),
  }),
);

export const rankingEvents = pgTable(
  "ranking_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    delta: integer("delta").notNull(),
    reason: rankingEventReasonEnum("reason").notNull(),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    note: text("note"),
    registeredById: uuid("registered_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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

export const freezes = pgTable(
  "freezes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    reason: text("reason").notNull(),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    playerIdx: index("freezes_player_idx").on(table.playerId),
    seasonIdx: index("freezes_season_idx").on(table.seasonId),
  }),
);

export const championships = pgTable(
  "championships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    category: genderEnum("category").notNull(),
    type: championshipTypeEnum("type").notNull().default("regular"),
    playedOn: date("played_on").notNull(),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    seasonIdx: index("championships_season_idx").on(table.seasonId),
    categoryIdx: index("championships_category_idx").on(table.category),
  }),
);

export const championshipPlacements = pgTable(
  "championship_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    championshipId: uuid("championship_id")
      .notNull()
      .references(() => championships.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    delta: integer("delta").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    champPlayerUnique: unique("champ_placements_champ_player_unique").on(
      table.championshipId,
      table.playerId,
    ),
    champPositionUnique: unique("champ_placements_champ_pos_unique").on(
      table.championshipId,
      table.position,
    ),
    champIdx: index("champ_placements_champ_idx").on(table.championshipId),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    payload: jsonb("payload"),
  },
  (table) => ({
    actorIdx: index("audit_log_actor_idx").on(table.actorId),
    entityIdx: index("audit_log_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    occurredAtIdx: index("audit_log_occurred_at_idx").on(table.occurredAt),
  }),
);
