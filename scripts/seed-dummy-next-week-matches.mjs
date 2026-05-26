import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(databaseUrl);

const WEEK_START = "2026-06-01";
const WEEK_END = "2026-06-07";

const pairings = [
  {
    playedOn: "2026-06-02",
    player1Name: "Roger Federer",
    player2Name: "Rafael Nadal",
    winnerName: "Roger Federer",
    format: "mr3",
    sets: [
      { setNumber: 1, gamesP1: 6, gamesP2: 4 },
      { setNumber: 2, gamesP1: 7, gamesP2: 6, tiebreakP1: 7, tiebreakP2: 5 },
    ],
  },
  {
    playedOn: "2026-06-03",
    player1Name: "Marcelo Rios",
    player2Name: "Andre Agassi",
    winnerName: "Marcelo Rios",
    format: "mr3",
    sets: [
      { setNumber: 1, gamesP1: 6, gamesP2: 3 },
      { setNumber: 2, gamesP1: 4, gamesP2: 6 },
      { setNumber: 3, gamesP1: 10, gamesP2: 8 },
    ],
  },
  {
    playedOn: "2026-06-04",
    player1Name: "Nicolas Massu",
    player2Name: "Nick Kyrgios",
    winnerName: "Nicolas Massu",
    format: "set_largo",
    sets: [
      { setNumber: 1, gamesP1: 9, gamesP2: 8, tiebreakP1: 7, tiebreakP2: 5 },
    ],
  },
  {
    playedOn: "2026-06-05",
    player1Name: "Fernando Gonzalez",
    player2Name: "Björn Borgm",
    winnerName: "Fernando Gonzalez",
    format: "mr3",
    sets: [
      { setNumber: 1, gamesP1: 7, gamesP2: 5 },
      { setNumber: 2, gamesP1: 6, gamesP2: 4 },
    ],
  },
  {
    playedOn: "2026-06-06",
    player1Name: "Boris Becker",
    player2Name: "Pete Sampras",
    winnerName: "Boris Becker",
    format: "mr3",
    sets: [
      { setNumber: 1, gamesP1: 6, gamesP2: 2 },
      { setNumber: 2, gamesP1: 3, gamesP2: 6 },
      { setNumber: 3, gamesP1: 10, gamesP2: 6 },
    ],
  },
];

const participantEmailsByName = new Map([
  ["Roger Federer", "escalerillaclubdegolf@gmail.com"],
  ["Rafael Nadal", "rafael.nadal@club.cl"],
  ["Marcelo Rios", "marcelo.rios@club.cl"],
  ["Andre Agassi", "andre.agassi@club.cl"],
  ["Nicolas Massu", "nicolas.massu@club.cl"],
  ["Nick Kyrgios", "nick.kyrgios@club.cl"],
  ["Fernando Gonzalez", "fernando.gonzalez@club.cl"],
  ["Björn Borgm", "bjorn.borgm@club.cl"],
  ["Boris Becker", "boris.becker@club.cl"],
  ["Pete Sampras", "pete.sampras@club.cl"],
]);

function loserPoints(format, sets) {
  if (format === "set_largo") return 10;
  return sets.length === 3 ? 30 : 20;
}

function loserReason(format, sets) {
  if (format === "set_largo") return "match_loss_set_largo";
  return sets.length === 3 ? "match_loss_3s" : "match_loss_2s";
}

function pairKey(a, b) {
  return [a, b].sort().join(":");
}

const playerNames = [...new Set(pairings.flatMap((p) => [p.player1Name, p.player2Name]))];
const participantEmails = playerNames.map((name) => participantEmailsByName.get(name));
const playerRows = await sql.query(
  `
    select p.id, p.full_name, p.gender, p.status, u.id as user_id
    from players p
    left join users u on u.player_id = p.id
    where p.email = any($1)
    order by p.full_name
  `,
  [participantEmails],
);

const playersByName = new Map();
for (const player of playerRows) {
  if (!playersByName.has(player.full_name)) {
    playersByName.set(player.full_name, player);
  }
}

const missing = playerNames.filter((name) => !playersByName.has(name));
if (missing.length > 0) {
  throw new Error(`Jugadores faltantes: ${missing.join(", ")}`);
}

for (const name of playerNames) {
  const player = playersByName.get(name);
  if (player.gender !== "M" || player.status !== "activo") {
    throw new Error(`${name} debe estar activo en categoria M`);
  }
}

const seasonRows = await sql.query(
  "select id from seasons where year = $1 and status = $2 limit 1",
  [2026, "activa"],
);

if (seasonRows.length !== 1) {
  throw new Error("No encontre una temporada 2026 activa");
}

await sql.query("begin");

try {
  const existingWeekRows = await sql.query(
    `
      select id
      from weeks
      where season_id = $1 and starts_on = $2 and ends_on = $3
      order by created_at
      limit 1
    `,
    [seasonRows[0].id, WEEK_START, WEEK_END],
  );

  const weekId =
    existingWeekRows[0]?.id ??
    (
      await sql.query(
        `
          insert into weeks (season_id, starts_on, ends_on, status, availability_closes_at)
          values ($1, $2, $3, 'cerrada', now())
          returning id
        `,
        [seasonRows[0].id, WEEK_START, WEEK_END],
      )
    )[0].id;

  await sql.query(
    `
      update weeks
      set status = 'cerrada', availability_closes_at = coalesce(availability_closes_at, now()), updated_at = now()
      where id = $1
    `,
    [weekId],
  );

  const playerIds = [...playersByName.values()].map((player) => player.id);
  await sql.query(
    `
      insert into availability (week_id, player_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, max_matches)
      select $1, unnest($2::uuid[]), true, true, true, true, true, true, true, 1
      on conflict (week_id, player_id) do update set
        monday = excluded.monday,
        tuesday = excluded.tuesday,
        wednesday = excluded.wednesday,
        thursday = excluded.thursday,
        friday = excluded.friday,
        saturday = excluded.saturday,
        sunday = excluded.sunday,
        max_matches = excluded.max_matches,
        updated_at = now()
    `,
    [weekId, playerIds],
  );

  const existingMatches = await sql.query(
    `
      select id, player1_id, player2_id
      from matches
      where week_id = $1
    `,
    [weekId],
  );
  const existingByPair = new Map(
    existingMatches.map((match) => [pairKey(match.player1_id, match.player2_id), match]),
  );

  const matchIds = [];

  for (const pairing of pairings) {
    const player1 = playersByName.get(pairing.player1Name);
    const player2 = playersByName.get(pairing.player2Name);
    const winner =
      pairing.winnerName === pairing.player1Name ? player1 : player2;
    const loser = winner.id === player1.id ? player2 : player1;

    const existing = existingByPair.get(pairKey(player1.id, player2.id));
    const matchId =
      existing?.id ??
      (
        await sql.query(
          `
            insert into matches (week_id, category, type, player1_id, player2_id, status)
            values ($1, 'M', 'sorteo', $2, $3, 'pendiente')
            returning id
          `,
          [weekId, player1.id, player2.id],
        )
      )[0].id;

    await sql.query(
      `
        update matches
        set
          week_id = $2,
          category = 'M',
          type = 'sorteo',
          player1_id = $3,
          player2_id = $4,
          played_on = $5,
          status = 'confirmado',
          format = $6,
          winner_id = $7,
          wo_loser_id = null,
          reported_at = $8,
          confirmed_at = $8
        where id = $1
      `,
      [
        matchId,
        weekId,
        player1.id,
        player2.id,
        pairing.playedOn,
        pairing.format,
        winner.id,
        `${pairing.playedOn}T12:00:00-04:00`,
      ],
    );

    await sql.query("delete from match_sets where match_id = $1", [matchId]);
    await sql.query("delete from ranking_events where ref_type = 'match' and ref_id = $1", [
      matchId,
    ]);

    for (const set of pairing.sets) {
      await sql.query(
        `
          insert into match_sets (
            match_id, set_number, games_p1, games_p2, tiebreak_p1, tiebreak_p2
          )
          values ($1, $2, $3, $4, $5, $6)
        `,
        [
          matchId,
          set.setNumber,
          set.gamesP1,
          set.gamesP2,
          set.tiebreakP1 ?? null,
          set.tiebreakP2 ?? null,
        ],
      );
    }

    await sql.query(
      `
        insert into ranking_events (player_id, occurred_at, delta, reason, ref_type, ref_id, note)
        values
          ($1, $2, 60, 'match_win', 'match', $3, 'Resultado dummy de prueba'),
          ($4, $2, $5, $6, 'match', $3, 'Resultado dummy de prueba')
      `,
      [
        winner.id,
        `${pairing.playedOn}T12:00:00-04:00`,
        matchId,
        loser.id,
        loserPoints(pairing.format, pairing.sets),
        loserReason(pairing.format, pairing.sets),
      ],
    );

    matchIds.push(matchId);
  }

  await sql.query(
    `
      insert into audit_log (action, entity_type, entity_id, payload)
      values ('dummy.next_week_fixture', 'week', $1, $2::jsonb)
    `,
    [
      weekId,
      JSON.stringify({
        startsOn: WEEK_START,
        endsOn: WEEK_END,
        matchIds,
        source: "scripts/seed-dummy-next-week-matches.mjs",
      }),
    ],
  );

  await sql.query(
    `
      with ranked as (
        select
          p.id,
          row_number() over (
            partition by p.gender
            order by coalesce(sum(re.delta), 0) desc, p.full_name asc
          ) as position
        from players p
        left join ranking_events re on re.player_id = p.id
        where p.status in ('activo', 'congelado')
        group by p.id, p.gender, p.full_name
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
  console.log(`Semana dummy creada/actualizada: ${WEEK_START} a ${WEEK_END}`);
  console.log(`Partidos confirmados: ${matchIds.length}`);
} catch (error) {
  await sql.query("rollback");
  throw error;
}
