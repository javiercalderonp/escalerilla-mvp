import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(databaseUrl);
const defaultVisibility = JSON.stringify({
  phone: 'players',
  rut: 'admin',
  birthDate: 'private',
});
const joinedLadderOn = '2026-01-01';

const players = [
  ['Roger Federer', 'escalerillaclubdegolf@gmail.com', 'M', 10000],
  ['Rafael Nadal', 'rafael.nadal@club.cl', 'M', 9000],
  ['Marcelo Rios', 'marcelo.rios@club.cl', 'M', 8000],
  ['Andre Agassi', 'andre.agassi@club.cl', 'M', 7000],
  ['Nicolas Massu', 'nicolas.massu@club.cl', 'M', 6000],
  ['Nick Kyrgios', 'nick.kyrgios@club.cl', 'M', 5000],
  ['Fernando Gonzalez', 'fernando.gonzalez@club.cl', 'M', 4000],
  ['Björn Borgm', 'bjorn.borgm@club.cl', 'M', 3000],
  ['Boris Becker', 'boris.becker@club.cl', 'M', 2000],
  ['Pete Sampras', 'pete.sampras@club.cl', 'M', 1000],
  ['Juan Pérez', 'juan.perez@club.cl', 'M', 420],
  ['Pedro García', 'pedro.garcia@club.cl', 'M', 380],
  ['Diego Rojas', 'diego.rojas@club.cl', 'M', 350],
  ['Mateo López', 'mateo.lopez@club.cl', 'M', 300],
  ['Sergio Muñoz', 'sergio.munoz@club.cl', 'M', 250],
  ['Ana Silva', 'ana.silva@club.cl', 'F', 410],
  ['María Torres', 'maria.torres@club.cl', 'F', 385],
  ['Josefa Ríos', 'josefa.rios@club.cl', 'F', 340],
  ['Catalina Reyes', 'catalina.reyes@club.cl', 'F', 315],
];

await sql`insert into seasons (year, status) values (2026, 'activa') on conflict (year) do nothing`;

for (const [fullName, email, gender, points] of players) {
  const [firstName, ...lastNameParts] = fullName.split(' ');
  const lastName = lastNameParts.join(' ');

  await sql`
    insert into players (
      full_name,
      first_name,
      last_name,
      email,
      gender,
      status,
      initial_points,
      joined_ladder_on,
      visibility
    )
    values (
      ${fullName},
      ${firstName},
      ${lastName},
      ${email},
      ${gender},
      'activo',
      ${points},
      ${joinedLadderOn},
      ${defaultVisibility}::jsonb
    )
    on conflict (email) do update set
      full_name = excluded.full_name,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      gender = excluded.gender,
      initial_points = excluded.initial_points,
      joined_ladder_on = excluded.joined_ladder_on,
      visibility = coalesce(players.visibility, excluded.visibility)
  `;

  await sql`
    insert into ranking_events (player_id, delta, reason, note)
    select p.id, ${points}, 'initial_seed', 'Seed inicial temporada 2026'
    from players p
    where p.email = ${email}
      and not exists (
        select 1
        from ranking_events re
        where re.player_id = p.id
          and re.reason = 'initial_seed'
      )
  `;
}

await sql`
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
`;

console.log(`Seed OK: ${players.length} jugadores base`);
