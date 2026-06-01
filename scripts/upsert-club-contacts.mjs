import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");

for (const line of env.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1].trim()]) {
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^[\"']|[\"']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const rows = [
  ["Agustín", "Achondo", "Hombres", "+56993326020", "achondo@gmail.com"],
  ["Maria Jose", "Albornoz", "Mujeres", "=+56976965721", "cotealbornoz@yahoo.com"],
  ["Alfonso", "Bou", "Hombres", "+56987310074", "bou.alfonso94@gmail.com"],
  ["Jonathan", "Budnik", "Hombres", "+56976596320", "jbudnik@gmail.com"],
  ["Javier", "Calderon", "Hombres", "=+56974340422", "Javier11calderon@gmail.com"],
  ["Catalina", "Cuesta", "Mujeres", "+56991379445", "catalinacuestarodriguez@gmail.com"],
  ["Francisco", "Cuevas", "Hombres", "+56979698806", "fcuevas4@gmail.com"],
  ["Raimundo", "Cuevas Ureta", "Hombres", "+56934560490", "Rdocuevas@gmail.com"],
  ["José Tomás", "Donoso", "Hombres", "+56996362684", "jtdonosor@gmail.com"],
  ["Joaquín", "Duval", "Hombres", "+56984295041", "jduval@topfrut.cl"],
  ["Pablo", "Garasa", "Hombres Senior", "=+56972137491", "Pgarasa@icloud.com"],
  ["David", "Geni", "Hombres", "+56977287894", "dgenir@gmail.com"],
  ["Jose Luis", "Halcartegaray Vergara", "Hombres", "+56994198791", "joseluis.hver@gmail.com"],
  ["Diego", "Hempel Souper", "Hombres", "+56992755500", "djhempel@uc.cl"],
  ["Felipe", "Hinzpeter", "Hombres", "+56977080169", "Hinzpeterfelipe@gmail.com"],
  ["Boris", "Kraizel", "Hombres", "+56998182993", "bkraizel@gmail.com"],
  ["Christian", "Lichtin", "Hombres", "+56996397805", "calichti1@gmail.com"],
  ["Jorge", "Lira Mayo", "Hombres", "+56985882280", "jorgeliram@gmail.com"],
  ["Juan", "Monckeberg", "Hombres", "=+56998860169", "drjuanmonckeberg@gmail.com"],
  ["Andres", "Muchnick", "Hombres", "=+56993090880", "andresmuchnick@gmail.com"],
  ["José", "Quiroga", "Hombres", "+56994999750", "jose.quiroga@ventumgroup.cl"],
  ["Jose", "Quiroga", "Hombres", "=+56994999750", "Jose@vibelife.cl"],
  ["Arturo", "Quiroz", "Hombres", "+56992997968", "aquirozl@gmail.com"],
  ["Mario", "Ramirez Lima", "Hombres Senior", "=+56965732101", "mrramirezlima@gmail.com"],
  ["Clemente", "Rosso", "Hombres", "+56995098608", "clementerosso@hotmail.com"],
  ["Tomás", "Saieh Ramirez", "Hombres", "+56947319809", "saiehtomas@gmail.com"],
  ["Margarita", "Salinas Gana", "Mujeres", "+56940989835", "margaritasalinasg@gmail.com"],
  ["Jacinta", "San Martin", "Mujeres", "+56978543129", "jacinta.smartin@gmail.com"],
  ["Benjamin", "Schilkrut", "Hombres", "=+56932570338", "schilkrutbenjamin@gmail.com"],
  ["Elias", "Schwartzman Stern", "Hombres", "=+56942765631", "eliasschwartzman@hebreo.cl"],
  ["Leonor", "Stanley", "Mujeres", "+56981596309", "lstanley@imicar.cl"],
  ["Tomas", "Stein Gazitua", "Hombres", "=+56962841734", "tomistein4@gmail.com"],
  ["Karina", "Stern Albagli", "Mujeres", "=+56982942786", "karinasterna@gmail.com"],
  ["Ignacio", "Streeter", "Hombres", "+56999176968", "ignaciosto@gmail.com"],
  ["Nicolas", "Tunik Dreiman", "Hombres", "=+56941628836", "nicolastunik@gmail.com"],
  ["Javier", "Ugarte", "Hombres", "+56983613491", "javierugarte@gmail.com"],
  ["Benjamin", "Urrutia", "Hombres", "+56966995596", "benjaurr@gmail.com"],
  ["Francisco", "Varela", "Hombres", "+56994965219", "franciscovarelam@gmail.com"],
  ["Marcelo", "Vargas Del Rio", "Hombres", "=+56999970758", "mfvargasdelrio@gmail.com"],
  ["Víctor Hugo", "Vasquez", "Hombres", "+56942785099", "vhvasquez@miuandes.cl"],
  ["Alfonso", "Vergara Albornoz", "Hombres", "=+56987750690", "vergaraalfonso11@gmail.com"],
  ["José Ignacio", "Vergara Albornoz", "Hombres", "=+56962937125", "Vergaraignacio10@gmail.com"],
  ["Domingo", "Vergara Iacobelli", "Hombres", "+56973601971", "domingts@gmail.com"],
  ["Anibal", "Vial", "Hombres", "+56989061814", "avial@ycia.cl"],
  ["Vicente", "Vicuña Loyola", "Hombres", "+56991859095", "vicentevl89@gmail.com"],
  ["Juan Pablo", "Vicuña Pruzzo", "Hombres", "+56992352320", "jpvicunap@gmail.com"],
  ["Tomas", "Yusin", "Hombres", "+56958021117", "Tomas.yusin.e@gmail.com"],
  ["Javier", "Zaliasnik Majlis", "Hombres", "+56994544999", "Jzaliasnik@gmail.com"],
];

const sql = neon(process.env.DATABASE_URL);

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value) {
  const cleaned = value.replace(/^=/, "").replace(/[\s().-]/g, "");

  if (/^\+569\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  throw new Error(`Invalid phone: ${value}`);
}

function genderFor(category) {
  return category.startsWith("Mujeres") ? "F" : "M";
}

const prepared = rows.map(([firstName, lastName, category, phone, email]) => {
  const fullName = `${firstName} ${lastName}`.trim();
  return {
    firstName,
    lastName,
    fullName,
    email: email.trim().toLowerCase(),
    phone: normalizePhone(phone),
    gender: genderFor(category),
    key: `${genderFor(category)}:${normalizeName(fullName)}`,
  };
});

const duplicateInputKeys = new Set();
const seenInputKeys = new Set();
for (const row of prepared) {
  if (seenInputKeys.has(row.key)) {
    duplicateInputKeys.add(row.key);
  }
  seenInputKeys.add(row.key);
}

const existing = await sql`
  select id, full_name, email, phone, gender
  from players
`;

const byName = new Map();
const byEmail = new Map();

for (const player of existing) {
  const key = `${player.gender}:${normalizeName(player.full_name)}`;
  const list = byName.get(key) ?? [];
  list.push(player);
  byName.set(key, list);

  if (player.email) {
    byEmail.set(player.email.toLowerCase(), player);
  }
}

const updated = [];
const created = [];
const skipped = [];
const processedKeys = new Set();

for (const row of prepared) {
  if (duplicateInputKeys.has(row.key) && processedKeys.has(row.key)) {
    skipped.push({
      fullName: row.fullName,
      reason: "duplicate_input_name",
      email: row.email,
    });
    continue;
  }

  processedKeys.add(row.key);

  const emailOwner = byEmail.get(row.email);
  const matches = byName.get(row.key) ?? [];

  if (matches.length > 1) {
    skipped.push({
      fullName: row.fullName,
      reason: "ambiguous_existing_name",
      matches: matches.map((match) => match.full_name),
    });
    continue;
  }

  const match = matches[0];

  if (match && emailOwner && emailOwner.id !== match.id) {
    skipped.push({
      fullName: row.fullName,
      reason: "email_owned_by_other_player",
      email: row.email,
      owner: emailOwner.full_name,
    });
    continue;
  }

  if (match) {
    await sql`
        update players
        set
          full_name = ${row.fullName},
          first_name = ${row.firstName},
          last_name = ${row.lastName},
          email = ${row.email},
          phone = ${row.phone},
          gender = ${row.gender},
          updated_at = now()
        where id = ${match.id}
      `;
    updated.push(row.fullName);
    byEmail.set(row.email, { ...match, email: row.email });
    continue;
  }

  if (emailOwner) {
    skipped.push({
      fullName: row.fullName,
      reason: "email_owned_by_other_player",
      email: row.email,
      owner: emailOwner.full_name,
    });
    continue;
  }

  const inserted = await sql`
      insert into players (
        full_name,
        first_name,
        last_name,
        email,
        phone,
        gender,
        status,
        visibility,
        joined_ladder_on
      )
      values (
        ${row.fullName},
        ${row.firstName},
        ${row.lastName},
        ${row.email},
        ${row.phone},
        ${row.gender},
        'activo',
        '{"phone":"players","rut":"admin","birthDate":"private"}'::jsonb,
        current_date
      )
      returning id, full_name, email, gender
    `;

  const player = inserted[0];
  created.push(row.fullName);
  byName.set(row.key, [player]);
  byEmail.set(row.email, player);
}

const result = { updated, created, skipped };

console.log(JSON.stringify(result, null, 2));
