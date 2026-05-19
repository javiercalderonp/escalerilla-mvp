import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const REVERSAL_NOTE = "Reverso temporal penalizacion inactividad 2026-05-18";
const INACTIVITY_REASONS = [
  "inactivity_month",
  "inactivity_3mo",
  "inactivity_6mo",
  "inactivity_1y",
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

function formatDelta(value) {
  return value > 0 ? `+${value}` : String(value);
}

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);

const rows = await sql.query(
  `
    with penalties as (
      select
        re.player_id,
        sum(-re.delta)::int as points_to_restore,
        count(*)::int as penalty_count,
        jsonb_object_agg(re.reason, reason_totals.points) as reason_totals
      from ranking_events re
      join (
        select player_id, reason, sum(-delta)::int as points
        from ranking_events
        where reason = any($1)
          and delta < 0
        group by player_id, reason
      ) reason_totals
        on reason_totals.player_id = re.player_id
       and reason_totals.reason = re.reason
      where re.reason = any($1)
        and re.delta < 0
      group by re.player_id
    ),
    reversals as (
      select
        player_id,
        coalesce(sum(delta), 0)::int as already_restored
      from ranking_events
      where reason = 'manual_adjustment'
        and note = $2
      group by player_id
    )
    select
      p.id as player_id,
      p.full_name,
      p.gender,
      penalties.points_to_restore,
      penalties.penalty_count,
      penalties.reason_totals,
      coalesce(reversals.already_restored, 0)::int as already_restored,
      (penalties.points_to_restore - coalesce(reversals.already_restored, 0))::int as remaining_restore
    from penalties
    join players p on p.id = penalties.player_id
    left join reversals on reversals.player_id = penalties.player_id
    where penalties.points_to_restore > coalesce(reversals.already_restored, 0)
    order by p.gender, p.full_name
  `,
  [INACTIVITY_REASONS, REVERSAL_NOTE],
);

const totalToRestore = rows.reduce(
  (sum, row) => sum + Number(row.remaining_restore),
  0,
);

console.log(
  `Plan: ${rows.length} jugadores con puntos por devolver, ${totalToRestore} puntos en total.`,
);

for (const row of rows) {
  console.log(
    `${row.gender} ${row.full_name}: ${formatDelta(Number(row.remaining_restore))} pts (${row.penalty_count} eventos, detalle ${JSON.stringify(row.reason_totals)})`,
  );
}

if (!apply) {
  console.log("Dry-run OK. Ejecuta con --apply para insertar compensaciones.");
  process.exit(0);
}

await sql.query("begin");
try {
  for (const row of rows) {
    await sql.query(
      `
        insert into ranking_events (player_id, delta, reason, ref_type, note)
        values ($1, $2, 'manual_adjustment', 'inactivity_pause', $3)
      `,
      [row.player_id, Number(row.remaining_restore), REVERSAL_NOTE],
    );
  }

  await sql.query(
    `
      insert into audit_log (action, entity_type, payload)
      values ('ranking.reverse_inactivity_penalties', 'ranking_events', $1::jsonb)
    `,
    [
      JSON.stringify({
        restoredPlayers: rows.length,
        restoredPoints: totalToRestore,
        note: REVERSAL_NOTE,
      }),
    ],
  );

  for (const gender of ["M", "F"]) {
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
          where p.status in ('activo', 'congelado') and p.gender = $1
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
      [gender],
    );
  }

  await sql.query("commit");
  console.log(
    `Compensaciones insertadas: ${rows.length} jugadores, ${totalToRestore} puntos.`,
  );
} catch (error) {
  await sql.query("rollback");
  throw error;
}
