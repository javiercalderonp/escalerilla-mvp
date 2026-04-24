# Data Model — Escalerilla de Tenis Club La Dehesa

> **Propósito**: schema completo de base de datos, tipos TS, formato de seed CSV y variables de entorno. Este documento es **la fuente única de verdad del modelo de datos**. Cualquier divergencia entre este documento y el código debe resolverse regenerando migraciones desde aquí.
>
> **Audiencia primaria**: agentes IA y desarrolladores. Todo está en forma directamente copiable.

---

## 1. Convenciones

- **Identificadores**: `uuid` v4, generados por la DB (`gen_random_uuid()` de Postgres).
- **Timestamps**: `timestamptz` (UTC) — conversión a `America/Santiago` sólo en capa de presentación.
- **Strings**: `text` (no `varchar(n)` salvo que se indique).
- **Enums**: definidos como Postgres `ENUM` types (para eficiencia y validación a nivel DB).
- **Naming**: `snake_case` para columnas y tablas, `camelCase` para nombres TS.
- **Soft delete**: solo para `players.status='retirado'`. Ninguna otra tabla se borra.
- **No hay `deleted_at`** — si se requiere borrar, se hace con auditoría.

---

## 2. Schema completo (Drizzle ORM)

Ubicación: `lib/db/schema.ts`.

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  boolean,
  pgEnum,
  unique,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ────────────────────────────────────────────────────────────
// ENUMS
// ────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'player', 'guest']);

export const genderEnum = pgEnum('gender', ['M', 'F']);

export const playerStatusEnum = pgEnum('player_status', [
  'activo',
  'congelado',
  'retirado',
]);

export const seasonStatusEnum = pgEnum('season_status', ['activa', 'cerrada']);

export const weekStatusEnum = pgEnum('week_status', [
  'disponibilidad_abierta',
  'disponibilidad_cerrada',
  'fixture_publicado',
  'cerrada',
]);

export const matchTypeEnum = pgEnum('match_type', [
  'sorteo',
  'desafio',
  'campeonato',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'pendiente',          // partido creado, sin resultado
  'reportado',          // resultado ingresado por jugador, esperando admin
  'confirmado',         // admin aprobó; puntos aplicados
  'wo',                 // walk over
  'empate',             // empate registrado y confirmado
]);

export const matchFormatEnum = pgEnum('match_format', ['mr3', 'set_largo']);

export const freezeReasonEnum = pgEnum('freeze_reason', [
  'lesion',
  'viaje',
  'otro',
]);

export const championshipKindEnum = pgEnum('championship_kind', [
  'regular',
  'clausura',
]);

export const placementEnum = pgEnum('placement', [
  'campeon',
  'finalista',
  'semifinalista',
  'cuartofinalista',
]);

export const rankingEventReasonEnum = pgEnum('ranking_event_reason', [
  'initial_seed',
  'match_win',
  'match_loss_3s',
  'match_loss_2s',
  'match_loss_set_largo',
  'match_draw',
  'wo_win',
  'wo_loss',
  'championship_bonus',
  'inactivity_month',
  'inactivity_3mo',
  'inactivity_6mo',
  'inactivity_1y',
  'manual_adjustment',
  'match_correction',   // evento compensatorio al editar resultado
]);

export const dayOfWeekEnum = pgEnum('day_of_week', [
  'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM',
]);

// ────────────────────────────────────────────────────────────
// TABLES
// ────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name'),
    image: text('image'),
    role: userRoleEnum('role').notNull().default('guest'),
    playerId: uuid('player_id').references(() => players.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
  }),
);

export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    email: text('email').unique(),
    gender: genderEnum('gender').notNull(),
    status: playerStatusEnum('status').notNull().default('activo'),
    initialPoints: integer('initial_points').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    genderStatusIdx: index('players_gender_status_idx').on(t.gender, t.status),
    emailIdx: index('players_email_idx').on(t.email),
  }),
);

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  year: integer('year').notNull().unique(),
  status: seasonStatusEnum('status').notNull().default('activa'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const weeks = pgTable(
  'weeks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    isoWeek: integer('iso_week').notNull(),
    startDate: date('start_date').notNull(), // lunes de la semana (America/Santiago)
    status: weekStatusEnum('status').notNull().default('disponibilidad_abierta'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => ({
    seasonWeekUnique: unique('weeks_season_iso_unique').on(
      t.seasonId,
      t.isoWeek,
    ),
    startDateIdx: index('weeks_start_date_idx').on(t.startDate),
  }),
);

export const availability = pgTable(
  'availability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    days: dayOfWeekEnum('days').array().notNull(), // postgres array
    maxMatches: integer('max_matches').notNull(), // 0..3
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    playerWeekUnique: unique('availability_player_week_unique').on(
      t.playerId,
      t.weekId,
    ),
  }),
);

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekId: uuid('week_id').references(() => weeks.id, { onDelete: 'set null' }),
    category: genderEnum('category').notNull(), // 'M' | 'F'
    type: matchTypeEnum('type').notNull(),
    player1Id: uuid('player1_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    player2Id: uuid('player2_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    playedOn: date('played_on'),
    status: matchStatusEnum('status').notNull().default('pendiente'),
    format: matchFormatEnum('format'), // null hasta que se registra resultado
    winnerId: uuid('winner_id').references(() => players.id, {
      onDelete: 'set null',
    }),
    woLoserId: uuid('wo_loser_id').references(() => players.id, {
      onDelete: 'set null',
    }),
    championshipId: uuid('championship_id').references(() => championships.id, {
      onDelete: 'set null',
    }),
    reportedById: uuid('reported_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    confirmedById: uuid('confirmed_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reportedAt: timestamp('reported_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    weekIdx: index('matches_week_idx').on(t.weekId),
    statusIdx: index('matches_status_idx').on(t.status),
    player1Idx: index('matches_player1_idx').on(t.player1Id),
    player2Idx: index('matches_player2_idx').on(t.player2Id),
    playedOnIdx: index('matches_played_on_idx').on(t.playedOn),
  }),
);

export const matchSets = pgTable(
  'match_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(), // 1..3
    gamesP1: integer('games_p1').notNull(),
    gamesP2: integer('games_p2').notNull(),
    tiebreakP1: integer('tiebreak_p1'),
    tiebreakP2: integer('tiebreak_p2'),
  },
  (t) => ({
    matchSetUnique: unique('match_sets_match_set_unique').on(
      t.matchId,
      t.setNumber,
    ),
  }),
);

export const freezes = pgTable(
  'freezes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    semester: integer('semester').notNull(), // 1 | 2
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    reason: freezeReasonEnum('reason').notNull(),
    notes: text('notes'),
    registeredById: uuid('registered_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    playerWeekUnique: unique('freezes_player_week_unique').on(
      t.playerId,
      t.weekId,
    ),
    playerSemesterIdx: index('freezes_player_semester_idx').on(
      t.playerId,
      t.seasonId,
      t.semester,
    ),
  }),
);

export const championships = pgTable('championships', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  kind: championshipKindEnum('kind').notNull(),
  category: genderEnum('category').notNull(),
  startedOn: date('started_on').notNull(),
  endedOn: date('ended_on'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const championshipPlacements = pgTable(
  'championship_placements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    championshipId: uuid('championship_id')
      .notNull()
      .references(() => championships.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    placement: placementEnum('placement').notNull(),
    registeredById: uuid('registered_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    champPlayerUnique: unique('championship_placements_champ_player_unique').on(
      t.championshipId,
      t.playerId,
    ),
  }),
);

export const rankingEvents = pgTable(
  'ranking_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    delta: integer('delta').notNull(),
    reason: rankingEventReasonEnum('reason').notNull(),
    refType: text('ref_type'), // 'match' | 'championship_placement' | 'manual' | etc.
    refId: uuid('ref_id'),
    note: text('note'),
    registeredById: uuid('registered_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    playerIdx: index('ranking_events_player_idx').on(t.playerId),
    occurredAtIdx: index('ranking_events_occurred_at_idx').on(t.occurredAt),
    playerOccurredIdx: index('ranking_events_player_occurred_idx').on(
      t.playerId,
      t.occurredAt,
    ),
    reasonIdx: index('ranking_events_reason_idx').on(t.reason),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(), // ej. 'match.register'
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload'),
  },
  (t) => ({
    actorIdx: index('audit_log_actor_idx').on(t.actorId),
    entityIdx: index('audit_log_entity_idx').on(t.entityType, t.entityId),
    occurredAtIdx: index('audit_log_occurred_at_idx').on(t.occurredAt),
  }),
);

// ────────────────────────────────────────────────────────────
// RELATIONS
// ────────────────────────────────────────────────────────────

export const playersRelations = relations(players, ({ many, one }) => ({
  user: one(users, {
    fields: [players.id],
    references: [users.playerId],
  }),
  availabilities: many(availability),
  matchesAsP1: many(matches, { relationName: 'player1' }),
  matchesAsP2: many(matches, { relationName: 'player2' }),
  freezes: many(freezes),
  rankingEvents: many(rankingEvents),
  championshipPlacements: many(championshipPlacements),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  week: one(weeks, { fields: [matches.weekId], references: [weeks.id] }),
  player1: one(players, {
    fields: [matches.player1Id],
    references: [players.id],
    relationName: 'player1',
  }),
  player2: one(players, {
    fields: [matches.player2Id],
    references: [players.id],
    relationName: 'player2',
  }),
  winner: one(players, {
    fields: [matches.winnerId],
    references: [players.id],
    relationName: 'winner',
  }),
  championship: one(championships, {
    fields: [matches.championshipId],
    references: [championships.id],
  }),
  sets: many(matchSets),
}));
```

---

## 3. Tipos TypeScript derivados

```ts
// lib/db/types.ts
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from './schema';

export type User = InferSelectModel<typeof schema.users>;
export type NewUser = InferInsertModel<typeof schema.users>;

export type Player = InferSelectModel<typeof schema.players>;
export type NewPlayer = InferInsertModel<typeof schema.players>;

export type Season = InferSelectModel<typeof schema.seasons>;
export type Week = InferSelectModel<typeof schema.weeks>;
export type Availability = InferSelectModel<typeof schema.availability>;
export type Match = InferSelectModel<typeof schema.matches>;
export type MatchSet = InferSelectModel<typeof schema.matchSets>;
export type Freeze = InferSelectModel<typeof schema.freezes>;
export type Championship = InferSelectModel<typeof schema.championships>;
export type ChampionshipPlacement = InferSelectModel<
  typeof schema.championshipPlacements
>;
export type RankingEvent = InferSelectModel<typeof schema.rankingEvents>;
export type AuditLogEntry = InferSelectModel<typeof schema.auditLog>;

// Tipos de enum como uniones literales de TS (para usar en UI y lógica)
export type Gender = 'M' | 'F';
export type PlayerStatus = 'activo' | 'congelado' | 'retirado';
export type MatchStatus = 'pendiente' | 'reportado' | 'confirmado' | 'wo' | 'empate';
export type MatchType = 'sorteo' | 'desafio' | 'campeonato';
export type MatchFormat = 'mr3' | 'set_largo';
export type DayOfWeek = 'LUN' | 'MAR' | 'MIE' | 'JUE' | 'VIE' | 'SAB' | 'DOM';
export type FreezeReason = 'lesion' | 'viaje' | 'otro';
export type Placement =
  | 'campeon'
  | 'finalista'
  | 'semifinalista'
  | 'cuartofinalista';
```

---

## 4. Constraints de aplicación (validados en código, no en DB)

Estos son invariantes críticos que se **validan en server actions** antes de persistir:

| Regla | Fuente | Validación |
|---|---|---|
| `matches.player1Id !== matches.player2Id` | — | rechazar en creación |
| `matches.category` coincide con `players[p1].gender === players[p2].gender` | Alcance MVP | rechazar si mixto |
| `matches.format` es obligatorio cuando `status IN ('reportado', 'confirmado', 'empate')` | RN-02 | rechazar si null |
| `matches.winnerId ∈ {player1Id, player2Id}` cuando no es empate ni WO | — | rechazar |
| `matches.woLoserId ∈ {player1Id, player2Id}` cuando status='wo' | RN-07 | rechazar |
| `availability.maxMatches` entre 0 y 3 | RN-04 | `check maxMatches BETWEEN 0 AND 3` |
| `match_sets.setNumber` entre 1 y 3 | RN-02 | `check setNumber BETWEEN 1 AND 3` |
| No más de 3 `freezes` por jugador por `(seasonId, semester)` | RN-09 | contar antes de insertar |
| No más de un `availability` por `(playerId, weekId)` | — | `unique constraint` |
| No más de un `match` tipo `sorteo` entre mismo par en 30 días | RN-03 | contar antes de insertar |

---

## 5. Formato del seed CSV

**Archivo esperado**: UTF-8, separador `,`, primera fila de cabeceras. Nombre sugerido: `seed-ranking-YYYY.csv`.

### Columnas

| Nombre | Tipo | Obligatorio | Ejemplo | Notas |
|---|---|:---:|---|---|
| `full_name` | texto | ✅ | `Juan Pérez López` | |
| `email` | texto | ❌ | `juan@gmail.com` | puede ser vacío; si existe debe ser único |
| `gender` | `M`\|`F` | ✅ | `M` | mayúscula exacta |
| `initial_points` | entero | ✅ | `320` | puede ser 0 |
| `notes` | texto | ❌ | `Ranking 2025: 5º lugar` | opcional |

### Ejemplo completo

```csv
full_name,email,gender,initial_points,notes
Juan Pérez López,juan@gmail.com,M,420,Ranking 2025: 3º
Pedro García,,M,380,
Diego Rojas,diego.rojas@gmail.com,M,350,
María Torres,maria.t@gmail.com,F,310,Ranking 2025: 1º femenino
Ana Silva,ana@gmail.com,F,290,
Camila Valdés,,F,270,Nueva este año
```

### Comportamiento al importar

1. Se parsea toda la fila por fila. Si hay errores se aborta **antes** de escribir nada.
2. Por cada fila válida:
   - Se crea `players` (rechaza si `email` duplicado dentro del CSV).
   - Si `initial_points > 0`, se crea un `ranking_events` con `reason='initial_seed'` y `delta=initial_points`.
3. Todo en una transacción. Si falla una fila, rollback completo.
4. El importador actualiza `players.initialPoints` con el valor del CSV.

### Duplicados

- Si el email ya existe en `players`, la fila se rechaza (no se hace merge).
- Si quiere reimportar, el admin debe primero borrar manualmente los jugadores (o usar una flag `--replace` que no está en MVP).

---

## 6. `.env.example`

Archivo a crear en la raíz del repo. Los agentes deben leerlo para saber qué variables necesitan.

```bash
# ────────────────────────────────────────────
# Base de datos (Neon via Vercel Marketplace)
# ────────────────────────────────────────────
# En local: crear branch de desarrollo en Neon y poner su URL.
# En Vercel: se inyecta automáticamente por la integración.
DATABASE_URL="postgres://user:password@host/db?sslmode=require"

# ────────────────────────────────────────────
# NextAuth
# ────────────────────────────────────────────
# Generar con: openssl rand -base64 32
NEXTAUTH_SECRET="replace-me-with-random-32-bytes-base64"

# URL pública del sitio. En Vercel se puede usar VERCEL_URL.
NEXTAUTH_URL="http://localhost:3000"

# ────────────────────────────────────────────
# Google OAuth
# ────────────────────────────────────────────
# Crear en https://console.cloud.google.com → APIs & Services → Credentials
# Callback URL: {NEXTAUTH_URL}/api/auth/callback/google
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ────────────────────────────────────────────
# Admins (MVP: lista CSV por env var)
# ────────────────────────────────────────────
# Emails separados por coma. Cualquier login con estos emails recibe role='admin'.
ADMIN_EMAILS="javier11calderon@gmail.com"

# ────────────────────────────────────────────
# Cron (Vercel Cron)
# ────────────────────────────────────────────
# Header Authorization: Bearer ${CRON_SECRET} protege el endpoint.
# En Vercel se configura como secreto oculto.
CRON_SECRET="replace-me-with-random-32-bytes"

# ────────────────────────────────────────────
# Zona horaria para cálculos de calendario
# ────────────────────────────────────────────
APP_TIMEZONE="America/Santiago"
```

### Variables por entorno

| Variable | local | preview | production |
|---|:---:|:---:|:---:|
| `DATABASE_URL` | Neon dev branch | Neon auto-branch | Neon main branch |
| `NEXTAUTH_SECRET` | random | distinto por entorno | distinto por entorno |
| `NEXTAUTH_URL` | `http://localhost:3000` | URL preview Vercel | dominio prod |
| `GOOGLE_CLIENT_ID` | OAuth client local | mismo | mismo |
| `GOOGLE_CLIENT_SECRET` | OAuth client local | mismo | mismo |
| `ADMIN_EMAILS` | email dev | lista staging | lista producción |
| `CRON_SECRET` | random local | random | random |
| `APP_TIMEZONE` | `America/Santiago` | mismo | mismo |

---

## 7. Ejemplos canónicos de datos (fixtures para tests)

### 7.1 Jugadores iniciales (subset de seed)

```ts
export const seedPlayers = [
  { fullName: 'Juan Pérez', gender: 'M', initialPoints: 420 },
  { fullName: 'Pedro García', gender: 'M', initialPoints: 380 },
  { fullName: 'Diego Rojas', gender: 'M', initialPoints: 350 },
  { fullName: 'Mateo López', gender: 'M', initialPoints: 300 },
  { fullName: 'Sergio Muñoz', gender: 'M', initialPoints: 250 },
  { fullName: 'María Torres', gender: 'F', initialPoints: 310 },
  { fullName: 'Ana Silva', gender: 'F', initialPoints: 290 },
  { fullName: 'Camila Valdés', gender: 'F', initialPoints: 270 },
];
```

### 7.2 Partido confirmado ejemplo (Juan gana a Pedro 6-4, 3-6, 10-7)

```ts
// matches
{ id: 'm-001', category: 'M', type: 'sorteo', player1Id: 'p-juan',
  player2Id: 'p-pedro', playedOn: '2026-04-22',
  status: 'confirmado', format: 'mr3', winnerId: 'p-juan', ... }

// match_sets
{ matchId: 'm-001', setNumber: 1, gamesP1: 6, gamesP2: 4 }
{ matchId: 'm-001', setNumber: 2, gamesP1: 3, gamesP2: 6 }
{ matchId: 'm-001', setNumber: 3, gamesP1: 10, gamesP2: 7,
  tiebreakP1: null, tiebreakP2: null }  // super tiebreak se guarda en games

// ranking_events (aplicados al confirmar)
{ playerId: 'p-juan', delta: +60, reason: 'match_win',
  refType: 'match', refId: 'm-001' }
{ playerId: 'p-pedro', delta: +30, reason: 'match_loss_3s',
  refType: 'match', refId: 'm-001' }
```

> **Nota importante**: el super tie-break del 3er set se almacena en `gamesP1` / `gamesP2` (10/7), NO en `tiebreakP1` / `tiebreakP2`. Los tiebreak columns son solo para tie-breaks del set corto (7-6 con score 7-5 interno) y del set largo (8-8 con tie-break a 7).

### 7.3 Partido set largo ejemplo (9-7)

```ts
{ matchId: 'm-002', setNumber: 1, gamesP1: 9, gamesP2: 7 }
// no hay más sets
// ranking_event perdedor: delta=+10, reason='match_loss_set_largo'
```

### 7.4 WO ejemplo

```ts
// matches
{ id: 'm-003', status: 'wo', woLoserId: 'p-pedro',
  winnerId: 'p-juan', format: 'mr3', ... }

// ranking_events
{ playerId: 'p-juan', delta: +60, reason: 'wo_win' }
{ playerId: 'p-pedro', delta: -20, reason: 'wo_loss' }
```

### 7.5 Empate MR3 (1-1 sets, juegos idénticos, sin tiempo)

```ts
{ matchId: 'm-004', setNumber: 1, gamesP1: 6, gamesP2: 3 }
{ matchId: 'm-004', setNumber: 2, gamesP1: 3, gamesP2: 6 }
// no hay 3er set
// matches.status = 'empate', winnerId = null

// ranking_events (ambos jugadores +35)
{ playerId: 'p-juan', delta: +35, reason: 'match_draw' }
{ playerId: 'p-pedro', delta: +35, reason: 'match_draw' }
```

---

## 8. Queries de referencia

### 8.1 Ranking vigente de una categoría

```sql
SELECT
  p.id,
  p.full_name,
  p.gender,
  COALESCE(SUM(re.delta), 0) AS points
FROM players p
LEFT JOIN ranking_events re ON re.player_id = p.id
WHERE p.gender = $1                   -- 'M' o 'F'
  AND p.status <> 'retirado'
GROUP BY p.id
ORDER BY points DESC, p.full_name ASC;
```

### 8.2 Partidos entre dos jugadores en últimos 30 días

```sql
SELECT *
FROM matches
WHERE status IN ('confirmado', 'empate', 'wo')
  AND (
    (player1_id = $1 AND player2_id = $2)
    OR
    (player1_id = $2 AND player2_id = $1)
  )
  AND played_on >= (CURRENT_DATE - INTERVAL '30 days')
ORDER BY played_on DESC;
```

### 8.3 Partidos de un jugador en semana ISO actual

```sql
SELECT *
FROM matches m
WHERE status IN ('confirmado', 'empate', 'wo')
  AND (m.player1_id = $1 OR m.player2_id = $1)
  AND m.played_on >= date_trunc('week', CURRENT_DATE)  -- lunes
  AND m.played_on < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days';
```

### 8.4 Freezes usados por jugador en semestre actual

```sql
SELECT COUNT(*)
FROM freezes
WHERE player_id = $1
  AND season_id = $2
  AND semester = $3;
```

---

## 9. Migraciones

- Drizzle Kit genera migraciones SQL. Se guardan en `drizzle/migrations/`.
- Comando dev: `pnpm drizzle-kit generate`.
- Comando apply: `pnpm drizzle-kit migrate` (o `push` en dev).
- **En CI/CD**: cada deploy a Vercel corre `drizzle-kit migrate` como parte del `build` si hay migraciones pendientes.
- **Rollbacks**: no soportados automáticamente. Si algo falla se escribe una nueva migración que deshaga el cambio.

---

## 10. Notas de implementación

- Todos los `timestamp` columnas usan `withTimezone: true` en Drizzle → `timestamptz` en Postgres.
- Los `date` columnas NO tienen timezone (son fecha civil local).
- `uuid` usa `gen_random_uuid()` de Postgres — requiere extensión `pgcrypto`. La primera migración debe incluir `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.
- Los enums de Postgres requieren `ALTER TYPE` para agregar valores. Si se agrega un valor nuevo al código, es una migración.
- **No usar `cascade` para borrar `players`** — si un jugador tiene partidos, no debería borrarse. `onDelete: 'restrict'` en las FKs críticas.
