import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const YEAR = 2026;

const INPUT = [
  {
    playedOn: "2026-05-21",
    originalPlayedOn: "21/5/1994",
    player1Name: "José Tomás Donoso",
    player2Name: "David Geni",
    outcome: "win",
    winnerIndex: 1,
    score: "6-2; 6-0",
  },
  {
    playedOn: "2026-05-22",
    player1Name: "Benjamin Schilkrut",
    player2Name: "Anibal Vial",
    outcome: "win",
    winnerIndex: 2,
    score: "6-1; 0-6; 10-5",
  },
  {
    playedOn: "2026-05-21",
    player1Name: "Diego Hempel Souper",
    player2Name: "Benjamin Urrutia",
    outcome: "draw",
    score: "6-3; 6-7",
  },
  {
    playedOn: "2026-05-24",
    player1Name: "David Geni",
    player2Name: "Juan Pablo Vicuña Pruzzo",
    outcome: "win",
    winnerIndex: 1,
    score: "6-1; 6-1",
  },
  {
    playedOn: "2026-05-24",
    player1Name: "Francisco Cuevas",
    player2Name: "Tomas Yusin",
    outcome: "win",
    winnerIndex: 1,
    score: "6-4; 6-4",
  },
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
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  throw new Error(`Fecha inesperada: ${value}`);
}

function parseScore(score) {
  const parts = score
    .trim()
    .split(/\s*;\s*|\s*,\s*|\s+(?=\d+-\d+)/)
    .filter(Boolean);

  return parts.map((raw, index) => {
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
  return INPUT.map((input) => {
    const scoreSets = parseScore(input.score);
    const sets =
      input.outcome === "win" && input.winnerIndex === 2
        ? scoreSets.map((set) => ({
            ...set,
            gamesP1: set.gamesP2,
            gamesP2: set.gamesP1,
          }))
        : scoreSets;
    const p1SetsWon = sets.filter((set) => set.gamesP1 > set.gamesP2).length;
    const p2SetsWon = sets.filter((set) => set.gamesP2 > set.gamesP1).length;

    if (input.outcome === "draw" && p1SetsWon !== p2SetsWon) {
      throw new Error(
        `El score no corresponde a empate: ${input.player1Name} vs ${input.player2Name}`,
      );
    }

    if (input.outcome === "win") {
      const expectedWinner = input.winnerIndex === 1 ? 1 : 2;
      const actualWinner = p1SetsWon > p2SetsWon ? 1 : 2;

      if (actualWinner !== expectedWinner) {
        throw new Error(
          `El ganador no coincide: ${input.player1Name} vs ${input.player2Name}`,
        );
      }
    }

    return {
      ...input,
      sets,
      score: formatScore(sets),
      invertedScore: formatInvertedScore(sets),
      format: getFormat(sets),
      week: weekForDate(input.playedOn),
    };
  });
}

function samePair(match, row) {
  const sameOrder =
    match.player1_id === row.player1.id && match.player2_id === row.player2.id;
  const reverseOrder =
    match.player1_id === row.player2.id && match.player2_id === row.player1.id;
  return sameOrder || reverseOrder;
}

function scoreMatches(match, row) {
  const sameOrder =
    match.player1_id === row.player1.id &&
    match.player2_id === row.player2.id &&
    match.score === row.score;
  const reverseOrder =
    match.player1_id === row.player2.id &&
    match.player2_id === row.player1.id &&
    match.score === row.invertedScore;
  return sameOrder || reverseOrder;
}

function orientRowForMatch(row, match) {
  if (match.player1_id === row.player1.id && match.player2_id === row.player2.id) {
    return row;
  }

  if (match.player1_id !== row.player2.id || match.player2_id !== row.player1.id) {
    throw new Error(`El partido ${match.id} no corresponde al par esperado`);
  }

  return {
    ...row,
    player1: row.player2,
    player2: row.player1,
    player1Name: row.player2Name,
    player2Name: row.player1Name,
    winnerIndex:
      row.outcome === "win" ? (row.winnerIndex === 1 ? 2 : 1) : row.winnerIndex,
    sets: row.sets.map((set) => ({
      ...set,
      gamesP1: set.gamesP2,
      gamesP2: set.gamesP1,
    })),
    score: row.invertedScore,
    invertedScore: row.score,
  };
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

const playerIds = rows.flatMap((row) => [row.player1.id, row.player2.id]);
const existingRows = await sql.query(
  `
    select
      m.id,
      m.week_id,
      m.played_on,
      m.status,
      m.type,
      m.player1_id,
      m.player2_id,
      string_agg(ms.games_p1 || '-' || ms.games_p2, '; ' order by ms.set_number) as score
    from matches m
    left join match_sets ms on ms.match_id = m.id
    where m.player1_id = any($1) and m.player2_id = any($1)
    group by m.id
  `,
  [[...new Set(playerIds)]],
);

const plan = rows.map((row) => {
  const resolvedDuplicate = existingRows.find((match) => {
    const statusMatches =
      match.status === (row.outcome === "draw" ? "empate" : "confirmado");
    return (
      statusMatches &&
      samePair(match, row) &&
      dateKey(match.played_on) === row.playedOn &&
      scoreMatches(match, row)
    );
  });

  if (resolvedDuplicate) {
    return {
      ...row,
      action: "skip",
      matchId: resolvedDuplicate.id,
      reason: "resultado ya existe",
    };
  }

  const pendingMatch = existingRows.find(
    (match) =>
      samePair(match, row) &&
      (match.status === "pendiente" || match.status === "reportado"),
  );

  if (pendingMatch) {
    return {
      ...orientRowForMatch(row, pendingMatch),
      action: "update",
      matchId: pendingMatch.id,
      existingWeekId: pendingMatch.week_id,
      reason: "partido pendiente encontrado",
    };
  }

  return { ...row, action: "insert", matchId: null, reason: "crear partido" };
});

console.log(
  `Plan: ${plan.filter((row) => row.action === "insert").length} por crear, ` +
    `${plan.filter((row) => row.action === "update").length} por actualizar, ` +
    `${plan.filter((row) => row.action === "skip").length} ya existentes.`,
);

for (const row of plan) {
  const outcome =
    row.outcome === "draw"
      ? "empate"
      : `gana ${row.winnerIndex === 1 ? row.player1Name : row.player2Name}`;
  const originalDateNote = row.originalPlayedOn
    ? ` (fecha original recibida: ${row.originalPlayedOn})`
    : "";
  console.log(
    `${row.action}: ${row.playedOn}${originalDateNote} ${row.player1Name} vs ${row.player2Name}, ${outcome}, ${row.score} - ${row.reason}${row.matchId ? ` ${row.matchId}` : ""}`,
  );
}

if (!apply) {
  console.log("Dry-run OK. Ejecuta con --apply para insertar/actualizar.");
  process.exit(0);
}

await sql.query("begin");
try {
  const weeksByKey = new Map();

  for (const row of plan.filter((item) => item.action !== "skip")) {
    if (row.existingWeekId) continue;

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

  for (const row of plan) {
    if (row.action === "skip") continue;

    const weekId =
      row.existingWeekId ?? weeksByKey.get(`${row.week.startsOn}:${row.week.endsOn}`);
    let matchId = row.matchId;

    if (row.action === "insert") {
      const insertedMatch = await sql.query(
        `
          insert into matches (
            week_id, category, type, player1_id, player2_id, played_on, status
          )
          values ($1, $2, 'sorteo', $3, $4, $5, 'pendiente')
          returning id
        `,
        [weekId, row.player1.gender, row.player1.id, row.player2.id, row.playedOn],
      );
      matchId = insertedMatch[0].id;
    }

    const winner =
      row.outcome === "win"
        ? row.winnerIndex === 1
          ? row.player1
          : row.player2
        : null;
    const loser =
      row.outcome === "win"
        ? row.winnerIndex === 1
          ? row.player2
          : row.player1
        : null;

    await sql.query(
      `
        update matches
        set
          week_id = coalesce(week_id, $2),
          played_on = $3,
          status = $4,
          format = $5,
          winner_id = $6,
          wo_loser_id = null,
          confirmed_at = $7
        where id = $1
      `,
      [
        matchId,
        weekId,
        row.playedOn,
        row.outcome === "draw" ? "empate" : "confirmado",
        row.format,
        winner?.id ?? null,
        `${row.playedOn}T12:00:00-04:00`,
      ],
    );

    await sql.query("delete from match_sets where match_id = $1", [matchId]);

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
      "delete from ranking_events where ref_type = 'match' and ref_id = $1",
      [matchId],
    );

    if (row.outcome === "draw") {
      await sql.query(
        `
          insert into ranking_events (player_id, occurred_at, delta, reason, ref_type, ref_id, note)
          values
            ($1, $2, 35, 'match_draw', 'match', $3, 'Resultado histórico cargado por script'),
            ($4, $2, 35, 'match_draw', 'match', $3, 'Resultado histórico cargado por script')
        `,
        [
          row.player1.id,
          `${row.playedOn}T12:00:00-04:00`,
          matchId,
          row.player2.id,
        ],
      );
    } else {
      await sql.query(
        `
          insert into ranking_events (player_id, occurred_at, delta, reason, ref_type, ref_id, note)
          values
            ($1, $2, 60, 'match_win', 'match', $3, 'Resultado histórico cargado por script'),
            ($4, $2, $5, $6, 'match', $3, 'Resultado histórico cargado por script')
        `,
        [
          winner.id,
          `${row.playedOn}T12:00:00-04:00`,
          matchId,
          loser.id,
          getLoserPoints(row.format, row.sets),
          getLoserReason(row.format, row.sets),
        ],
      );
    }

    await sql.query(
      `
        insert into audit_log (action, entity_type, entity_id, payload)
        values ('match.import_historical_result', 'match', $1, $2::jsonb)
      `,
      [
        matchId,
        JSON.stringify({
          playedOn: row.playedOn,
          originalPlayedOn: row.originalPlayedOn ?? row.playedOn,
          player1Name: row.player1Name,
          player2Name: row.player2Name,
          outcome: row.outcome,
          winnerName: winner?.full_name ?? null,
          score: row.score,
          source: "scripts/add-may-21-24-2026-results.mjs",
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
  console.log(
    `Aplicado: ${plan.filter((row) => row.action === "insert").length} creados, ` +
      `${plan.filter((row) => row.action === "update").length} actualizados, ` +
      `${plan.filter((row) => row.action === "skip").length} omitidos.`,
  );
} catch (error) {
  await sql.query("rollback");
  throw error;
}
