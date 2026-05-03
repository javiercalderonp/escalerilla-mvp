import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const YEAR = 2026;

const INPUT = [
  {
    semana: "2-9 marzo",
    partidos: [
      ["Alfonso Bou", "José Ignacio Vergara Albornoz", "9-0"],
      ["Arturo Quiroz", "Víctor Hugo Vasquez", "6-1; 6-0"],
      ["Domingo Vergara Iacobelli", "Francisco Cuevas", "3-6; 7-6; 10-6"],
      ["Alfonso Vergara Albornoz", "Tomas Yusin", "6-4; 6-3"],
      ["Diego Hempel Souper", "Jose Luis Halcartegaray Vergara", "6-1; 6-0"],
      ["Karina Stern Albagli", "Margarita Salinas Gana", "4-6; 6-3; 10-8"],
      ["Vicente Vicuña Loyola", "Anibal Vial", "6-1; 6-0"],
      ["Jonathan Budnik", "Benjamin Urrutia", "2-6; 6-4; 10-5"],
      ["Christian Lichtin", "Raimundo Cuevas Ureta", "6-1; 6-1"],
      ["David Geni", "Juan Pablo Vicuña Pruzzo", "6-0; 6-2"],
      ["Javier Ugarte", "Agustín Achondo", "6-3; 6-1"],
    ],
  },
  {
    semana: "10-16 marzo",
    partidos: [
      ["Francisco Varela", "Mario Ramirez Lima", "6-3; 3-6"],
      ["Víctor Hugo Vasquez", "José Ignacio Vergara Albornoz", "9-0"],
      ["Margarita Salinas Gana", "Maria Jose Albornoz", "6-1; 6-4"],
      ["Elias Schwartzman Stern", "Pablo Garasa", "6-1; 6-3"],
      ["Jonathan Budnik", "Alfonso Vergara Albornoz", "6-3; 6-1"],
      ["Anibal Vial", "Juan Pablo Vicuña Pruzzo", "6-4; 2-6; 11-8"],
      ["Joaquín Duval", "José Tomás Donoso", "6-4; 6-3"],
      ["Benjamin Urrutia", "Christian Lichtin", "6-3; 7-5"],
      ["Vicente Vicuña Loyola", "Arturo Quiroz", "6-0; 6-2"],
      ["Benjamin Urrutia", "Domingo Vergara Iacobelli", "9-2"],
      ["David Geni", "Javier Ugarte", "6-1; 6-1"],
      ["Tomás Saieh Ramirez", "Felipe Hinzpeter", "6-1; 6-0"],
      ["Agustín Achondo", "Raimundo Cuevas Ureta", "6-1; 6-1"],
    ],
  },
  {
    semana: "17-23 marzo",
    partidos: [
      ["Diego Hempel Souper", "Alfonso Vergara Albornoz", "9-1"],
      ["Tomas Yusin", "Francisco Cuevas", "9-5"],
      ["Pablo Garasa", "Jose Luis Halcartegaray Vergara", "2-6; 3-6"],
      ["Andres Muchnick", "José Quiroga", "6-0; 6-0"],
      ["José Tomás Donoso", "Francisco Cuevas", "6-1; 6-1"],
      ["David Geni", "Benjamin Urrutia", "6-4; 3-4"],
      ["Arturo Quiroz", "Christian Lichtin", "4-6; 6-3; 10-6"],
      ["José Ignacio Vergara Albornoz", "Felipe Hinzpeter", "6-3; 6-4"],
      ["Juan Pablo Vicuña Pruzzo", "Elias Schwartzman Stern", "6-4; 3-0"],
      ["Agustín Achondo", "Javier Ugarte", "6-3; 1-6; 10-5"],
    ],
  },
  {
    semana: "24-31 marzo",
    partidos: [
      ["Benjamin Schilkrut", "Francisco Varela", "6-3; 6-0"],
      ["José Ignacio Vergara Albornoz", "Tomas Yusin", "9-4"],
      ["Alfonso Vergara Albornoz", "Domingo Vergara Iacobelli", "6-1; 6-4"],
      ["Catalina Cuesta", "Jacinta San Martin", "2-9"],
      ["Maria Jose Albornoz", "Leonor Stanley", "6-0; 6-1"],
      ["Tomas Stein Gazitua", "Javier Calderon", "0-6; 0-6"],
      ["Jonathan Budnik", "Christian Lichtin", "7-5; 6-2"],
      ["Diego Hempel Souper", "Vicente Vicuña Loyola", "6-3; 5-7; 10-8"],
      ["Javier Calderon", "Tomas Stein Gazitua", "6-0; 6-1"],
      ["David Geni", "Agustín Achondo", "6-4; 6-2"],
      ["Andres Muchnick", "Boris Kraizel", "7-5; 6-3"],
      ["Tomás Saieh Ramirez", "Agustín Achondo", "6-0; 6-2"],
    ],
  },
  {
    semana: "1-6 abril",
    partidos: [
      ["José Tomás Donoso", "Elias Schwartzman Stern", "6-3; 7-5"],
      ["Vicente Vicuña Loyola", "David Geni", "6-3; 6-2"],
    ],
  },
  {
    semana: "7-13 abril",
    partidos: [
      ["Tomás Saieh Ramirez", "Francisco Cuevas", "6-1; 6-0"],
      ["Anibal Vial", "Tomas Yusin", "6-2; 2-6; 10-8"],
      ["David Geni", "Jonathan Budnik", "7-6; 6-1"],
      ["Pablo Garasa", "Raimundo Cuevas Ureta", "6-4; 6-2"],
      ["Vicente Vicuña Loyola", "Benjamin Urrutia", "1-6; 6-1; 10-8"],
      ["Boris Kraizel", "Tomas Stein Gazitua", "6-0; 6-0"],
      ["Javier Calderon", "Juan Pablo Vicuña Pruzzo", "7-5; 4-6; 11-9"],
      ["Benjamin Schilkrut", "Francisco Cuevas", "6-0; 6-1"],
      ["Tomás Saieh Ramirez", "Arturo Quiroz", "6-2; 6-2"],
    ],
  },
  {
    semana: "14-20 abril",
    partidos: [
      ["Benjamin Schilkrut", "Tomas Stein Gazitua", "6-0; 6-0"],
      ["José Tomás Donoso", "Arturo Quiroz", "6-3; 6-2"],
      ["Agustín Achondo", "Javier Calderon", "6-4; 6-3"],
    ],
  },
];

const MONTHS = new Map([
  ["marzo", 3],
  ["abril", 4],
]);

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

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseWeek(label) {
  const match = label.match(/^(\d+)-(\d+) (marzo|abril)$/);
  if (!match) throw new Error(`Semana inválida: ${label}`);
  const [, startDay, endDay, monthName] = match;
  const month = MONTHS.get(monthName);
  return {
    label,
    startsOn: `${YEAR}-${String(month).padStart(2, "0")}-${startDay.padStart(2, "0")}`,
    endsOn: `${YEAR}-${String(month).padStart(2, "0")}-${endDay.padStart(2, "0")}`,
  };
}

function parseScore(score) {
  return score
    .split(";")
    .map((set) => set.trim())
    .filter(Boolean)
    .join("; ");
}

function invertScore(score) {
  return score
    .split(";")
    .map((set) => {
      const [a, b] = set.trim().split("-").map((part) => part.trim());
      return `${b}-${a}`;
    })
    .join("; ");
}

function hashDateOffset(seed, days) {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % days;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function randomDateInWeek(week, matchIndex, p1, p2) {
  const start = new Date(`${week.startsOn}T00:00:00Z`);
  const end = new Date(`${week.endsOn}T00:00:00Z`);
  const days = Math.floor((end - start) / 86400000) + 1;
  return addDays(week.startsOn, hashDateOffset(`${week.label}:${matchIndex}:${p1}:${p2}`, days));
}

function buildExpectedRows() {
  return INPUT.flatMap((weekInput) => {
    const week = parseWeek(weekInput.semana);
    return weekInput.partidos.map(([p1, p2, score], index) => ({
      week,
      p1,
      p2,
      score: parseScore(score),
      playedOn: randomDateInWeek(week, index + 1, p1, p2),
    }));
  });
}

loadEnv();

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);
const expectedRows = buildExpectedRows();

const seasonRows = await sql`
  select id
  from seasons
  where year = ${YEAR}
  limit 1
`;

if (seasonRows.length !== 1) {
  throw new Error(`No encontré temporada ${YEAR}`);
}

const dbMatches = await sql`
  select
    m.id,
    p1.full_name as player1_name,
    p2.full_name as player2_name,
    string_agg(ms.games_p1 || '-' || ms.games_p2, '; ' order by ms.set_number) as score
  from matches m
  join players p1 on p1.id = m.player1_id
  join players p2 on p2.id = m.player2_id
  join match_sets ms on ms.match_id = m.id
  group by m.id, p1.full_name, p2.full_name
`;

const used = new Set();
const plan = expectedRows.map((row) => {
  const candidates = dbMatches.filter((match) => {
    if (used.has(match.id)) return false;

    const sameOrder =
      normalize(match.player1_name) === normalize(row.p1) &&
      normalize(match.player2_name) === normalize(row.p2) &&
      match.score === row.score;

    const reverseOrder =
      normalize(match.player1_name) === normalize(row.p2) &&
      normalize(match.player2_name) === normalize(row.p1) &&
      match.score === invertScore(row.score);

    return sameOrder || reverseOrder;
  });

  if (candidates.length === 1) used.add(candidates[0].id);

  return {
    ...row,
    matchId: candidates[0]?.id,
    candidates: candidates.length,
  };
});

const unmatched = plan.filter((row) => row.candidates !== 1);
if (unmatched.length > 0) {
  console.error(JSON.stringify(unmatched, null, 2));
  throw new Error(`Hay ${unmatched.length} partidos sin match único`);
}

console.log(`Validado: ${plan.length}/${expectedRows.length} partidos con match único.`);

if (!apply) {
  console.log("Dry-run OK. Ejecuta con --apply para actualizar.");
  process.exit(0);
}

await sql`begin`;
try {
  const weeksByKey = new Map();
  for (const row of plan) {
    const key = `${row.week.startsOn}:${row.week.endsOn}`;
    if (weeksByKey.has(key)) continue;

    const existingWeek = await sql`
      select id
      from weeks
      where season_id = ${seasonRows[0].id}
        and starts_on = ${row.week.startsOn}
        and ends_on = ${row.week.endsOn}
      order by created_at
      limit 1
    `;

    if (existingWeek.length > 0) {
      weeksByKey.set(key, existingWeek[0].id);
      continue;
    }

    const insertedWeek = await sql`
      insert into weeks (season_id, starts_on, ends_on, status)
      values (${seasonRows[0].id}, ${row.week.startsOn}, ${row.week.endsOn}, 'cerrada')
      returning id
    `;
    weeksByKey.set(key, insertedWeek[0].id);
  }

  for (const row of plan) {
    const weekId = weeksByKey.get(`${row.week.startsOn}:${row.week.endsOn}`);
    await sql`
      update matches
      set week_id = ${weekId}, played_on = ${row.playedOn}
      where id = ${row.matchId}
    `;
  }

  await sql`commit`;
  console.log(`Actualizados ${plan.length} partidos y ${weeksByKey.size} semanas.`);
} catch (error) {
  await sql`rollback`;
  throw error;
}
