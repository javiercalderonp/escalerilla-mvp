import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const YEAR = 2026;

const INPUT = [
  ["2026-04-24", "David Geni", "Javier Calderon", "6-2; 6-2"],
  ["2026-04-25", "Vicente Vicuña Loyola", "Jonathan Budnik", "6-4; 6-0"],
  ["2026-04-24", "Pablo Garasa", "Juan Monckeberg", "6-4; 6-4"],
  ["2026-04-15", "Juan Monckeberg", "José Quiroga", "9-7"],
  ["2026-04-26", "Ignacio Streeter", "Pablo Garasa", "6-0; 6-2"],
  ["2026-04-22", "Juan Monckeberg", "José Quiroga", "9-7"],
  ["2026-04-29", "Diego Hempel Souper", "Benjamin Schilkrut", "6-0; 6-1"],
  ["2026-04-30", "Javier Calderon", "Javier Ugarte", "6-1; 6-7; 10-5"],
  ["2026-05-03", "David Geni", "Agustín Achondo", "6-3; 6-1"],
  ["2026-05-03", "Benjamin Urrutia", "Ignacio Streeter", "6-2; 6-0"],
  ["2026-05-08", "José Tomás Donoso", "Pablo Garasa", "6-2; 6-0"],
  ["2026-05-08", "Benjamin Urrutia", "Vicente Vicuña Loyola", "6-3; 6-3"],
  ["2026-05-08", "Alfonso Bou", "Javier Calderon", "9-1"],
  ["2026-05-09", "Jonathan Budnik", "Benjamin Schilkrut", "6-2; 6-2"],
];

function loadEnv() {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2]
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekForDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  return {
    startsOn: addDays(dateString, -daysFromMonday),
    endsOn: addDays(dateString, 6 - daysFromMonday),
  };
}

function dateKey(value) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  throw new Error(`Fecha inesperada: ${value}`);
}

function parseScore(score) {
  return score.split(";").map((raw, index) => {
    const match = raw.trim().match(/^(\d+)-(\d+)$/);
    if (!match) throw new Error(`Score inválido: ${score}`);
    return {
      setNumber: index + 1,
      gamesP1: Number(match[1]),
      gamesP2: Number(match[2]),
    };
  });
}

function formatScore(sets) {
  return sets.map((set) => `${set.gamesP1}-${set.gamesP2}`).join("; ");
}

function formatInvertedScore(sets) {
  return sets.map((set) => `${set.gamesP2}-${set.gamesP1}`).join("; ");
}

function getFormat(sets) {
  return sets.length === 1 ? "set_largo" : "mr3";
}

function getLoserReason(format, sets) {
  if (format === "set_largo") return "match_loss_set_largo";
  return sets.length >= 3 ? "match_loss_3s" : "match_loss_2s";
}

function getLoserPoints(format, sets) {
  if (format === "set_largo") return 10;
  return sets.length >= 3 ? 30 : 20;
}

function normalizeRows() {
  return INPUT.map(([playedOn, player1Name, player2Name, score]) => {
    const sets = parseScore(score);
    const p1SetsWon = sets.filter((set) => set.gamesP1 > set.gamesP2).length;
    const p2SetsWon = sets.filter((set) => set.gamesP2 > set.gamesP1).length;

    if (p1SetsWon <= p2SetsWon) {
      throw new Error(
        `El ganador no coincide con Jugador 1: ${player1Name} vs ${player2Name}`,
      );
    }

    return {
      playedOn,
      player1Name,
      player2Name,
      sets,
      score: formatScore(sets),
      invertedScore: formatInvertedScore(sets),
      format: getFormat(sets),
      week: weekForDate(playedOn),
    };
  });
}

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const apply = process.argv.includes("--apply");
const rows = normalizeRows();
const sql = neon(process.env.DATABASE_URL);

const seasonRows = await sql.query(
  "select id from seasons where year = $1 limit 1",
  [YEAR],
);

if (seasonRows.length !== 1) {
  throw new Error(`No encontré temporada ${YEAR}`);
}

const names = [
  ...new Set(rows.flatMap((row) => [row.player1Name, row.player2Name])),
];
const playerRows = await sql.query(
  "select id, full_name, gender, status from players where full_name = any($1)",
  [names],
);
const playersByName = new Map(
  playerRows.map((player) => [player.full_name, player]),
);
const missingPlayers = names.filter((name) => !playersByName.has(name));

if (missingPlayers.length > 0) {
  throw new Error(`Jugadores faltantes: ${missingPlayers.join(", ")}`);
}

for (const row of rows) {
  const player1 = playersByName.get(row.player1Name);
  const player2 = playersByName.get(row.player2Name);

  if (player1.gender !== player2.gender) {
    throw new Error(
      `Categorías distintas: ${row.player1Name} vs ${row.player2Name}`,
    );
  }

  if (player1.status !== "activo" || player2.status !== "activo") {
    throw new Error(
      `Jugador no activo: ${row.player1Name} vs ${row.player2Name}`,
    );
  }

  row.player1 = player1;
  row.player2 = player2;
}

const existingRows = await sql.query(
  `
    select
      m.id,
      m.played_on,
      m.player1_id,
      m.player2_id,
      string_agg(ms.games_p1 || '-' || ms.games_p2, '; ' order by ms.set_number) as score
    from matches m
    join match_sets ms on ms.match_id = m.id
    where m.played_on between '2026-04-15' and '2026-05-09'
    group by m.id, m.played_on, m.player1_id, m.player2_id
  `,
);

const plan = rows.map((row) => {
  const duplicate = existingRows.find((match) => {
    const sameOrder =
      dateKey(match.played_on) === row.playedOn &&
      match.player1_id === row.player1.id &&
      match.player2_id === row.player2.id &&
      match.score === row.score;

    const reverseOrder =
      dateKey(match.played_on) === row.playedOn &&
      match.player1_id === row.player2.id &&
      match.player2_id === row.player1.id &&
      match.score === row.invertedScore;

    return sameOrder || reverseOrder;
  });

  return { ...row, duplicateId: duplicate?.id ?? null };
});

const toInsert = plan.filter((row) => row.duplicateId == null);

console.log(
  `Plan: ${toInsert.length} por insertar, ${plan.length - toInsert.length} ya existentes.`,
);
for (const row of plan) {
  const state = row.duplicateId ? `ya existe ${row.duplicateId}` : "insertar";
  console.log(
    `${state}: ${row.playedOn} ${row.player1Name} d. ${row.player2Name} ${row.score}`,
  );
}

if (!apply) {
  console.log("Dry-run OK. Ejecuta con --apply para insertar.");
  process.exit(0);
}

await sql.query("begin");
try {
  const weeksByKey = new Map();

  for (const row of toInsert) {
    const key = `${row.week.startsOn}:${row.week.endsOn}`;
    if (weeksByKey.has(key)) continue;

    const existingWeek = await sql.query(
      `
        select id
        from weeks
        where season_id = $1 and starts_on = $2 and ends_on = $3
        order by created_at
        limit 1
      `,
      [seasonRows[0].id, row.week.startsOn, row.week.endsOn],
    );

    if (existingWeek.length > 0) {
      weeksByKey.set(key, existingWeek[0].id);
      continue;
    }

    const insertedWeek = await sql.query(
      `
        insert into weeks (season_id, starts_on, ends_on, status)
        values ($1, $2, $3, 'cerrada')
        returning id
      `,
      [seasonRows[0].id, row.week.startsOn, row.week.endsOn],
    );
    weeksByKey.set(key, insertedWeek[0].id);
  }

  for (const row of toInsert) {
    const weekId = weeksByKey.get(`${row.week.startsOn}:${row.week.endsOn}`);
    const insertedMatch = await sql.query(
      `
        insert into matches (
          week_id, category, type, player1_id, player2_id, played_on,
          status, format, winner_id, confirmed_at
        )
        values ($1, $2, 'sorteo', $3, $4, $5, 'confirmado', $6, $3, $7)
        returning id
      `,
      [
        weekId,
        row.player1.gender,
        row.player1.id,
        row.player2.id,
        row.playedOn,
        row.format,
        `${row.playedOn}T12:00:00-04:00`,
      ],
    );

    const matchId = insertedMatch[0].id;

    for (const set of row.sets) {
      await sql.query(
        `
          insert into match_sets (match_id, set_number, games_p1, games_p2)
          values ($1, $2, $3, $4)
        `,
        [matchId, set.setNumber, set.gamesP1, set.gamesP2],
      );
    }

    await sql.query(
      `
        insert into ranking_events (player_id, occurred_at, delta, reason, ref_type, ref_id, note)
        values
          ($1, $2, 60, 'match_win', 'match', $3, 'Resultado histórico cargado por script'),
          ($4, $2, $5, $6, 'match', $3, 'Resultado histórico cargado por script')
      `,
      [
        row.player1.id,
        `${row.playedOn}T12:00:00-04:00`,
        matchId,
        row.player2.id,
        getLoserPoints(row.format, row.sets),
        getLoserReason(row.format, row.sets),
      ],
    );

    await sql.query(
      `
        insert into audit_log (action, entity_type, entity_id, payload)
        values ('match.import_historical_result', 'match', $1, $2::jsonb)
      `,
      [
        matchId,
        JSON.stringify({
          playedOn: row.playedOn,
          player1Name: row.player1Name,
          player2Name: row.player2Name,
          score: row.score,
          source: "scripts/add-apr-may-2026-results.mjs",
        }),
      ],
    );
  }

  await sql.query(
    `
      with ranked as (
        select
          p.id,
          row_number() over (
            order by coalesce(sum(re.delta), 0) desc, p.full_name asc
          ) as position
        from players p
        left join ranking_events re on re.player_id = p.id
        where p.status in ('activo', 'congelado') and p.gender = 'M'
        group by p.id, p.full_name
      )
      update players p
      set
        best_ranking_position = ranked.position,
        best_ranking_achieved_at = now()
      from ranked
      where p.id = ranked.id
        and (
          p.best_ranking_position is null
          or ranked.position < p.best_ranking_position
        )
    `,
  );

  await sql.query("commit");
  console.log(`Insertados ${toInsert.length} resultados nuevos.`);
} catch (error) {
  await sql.query("rollback");
  throw error;
}
