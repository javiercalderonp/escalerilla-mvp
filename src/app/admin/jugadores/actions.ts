"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import { auditLog, players, rankingEvents } from "@/lib/db/schema";
import { refreshHistoricalBestRanking } from "@/lib/ranking";

const playerSchema = z.object({
  fullName: z.string().trim().min(3, "Nombre demasiado corto").max(120),
  email: z
    .union([z.string().trim().email("Email inválido"), z.literal("")])
    .optional(),
  gender: z.enum(["M", "F"]),
  status: z.enum(["pendiente", "activo", "congelado", "retirado"]),
  level: z
    .union([
      z.enum([
        "principiante",
        "intermedio_bajo",
        "intermedio_alto",
        "avanzado",
      ]),
      z.literal(""),
    ])
    .optional(),
  initialPoints: z.coerce.number().int().min(0).max(9999),
  notes: z.string().trim().max(1000).optional(),
});

const csvRowSchema = z.object({
  fullName: z.string().trim().min(3, "Nombre demasiado corto").max(120),
  email: z.union([z.string().trim().email("Email inválido"), z.literal("")]),
  gender: z.enum(["M", "F"], "Categoría inválida; usa M o F"),
  initialPoints: z.coerce.number().int().min(0).max(9999),
  notes: z.string().trim().max(1000).optional(),
});

async function requireAdminActor() {
  const session = await auth();

  if (!session?.user?.email || session.user.role !== "admin") {
    throw new Error("No autorizado");
  }

  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const actor = await ensureAppUser(session.user);

  return { actorId: actor.id, dbClient };
}

function normalizeOptional(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error("comillas sin cerrar");
  }

  values.push(current.trim());
  return values;
}

function parseSeedCsv(input: string) {
  const normalized = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!normalized) {
    throw new Error("CSV vacío");
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("El CSV debe traer cabecera y al menos una fila");
  }

  const headers = parseCsvLine(lines[0]);
  const expectedHeaders = [
    "full_name",
    "email",
    "gender",
    "initial_points",
    "notes",
  ];

  if (headers.join("|") !== expectedHeaders.join("|")) {
    throw new Error(
      `Cabeceras inválidas. Esperaba: ${expectedHeaders.join(", ")}`,
    );
  }

  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);

    if (values.length !== expectedHeaders.length) {
      throw new Error(
        `Fila ${index + 2}: esperaba ${expectedHeaders.length} columnas`,
      );
    }

    const parsed = csvRowSchema.safeParse({
      fullName: values[0],
      email: values[1],
      gender: values[2],
      initialPoints: values[3],
      notes: values[4],
    });

    if (!parsed.success) {
      throw new Error(
        `Fila ${index + 2}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`,
      );
    }

    return parsed.data;
  });

  const seenEmails = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const email = row.email.trim().toLowerCase();

    if (!email) {
      continue;
    }

    if (seenEmails.has(email)) {
      throw new Error(
        `Fila ${index + 2}: email duplicado dentro del CSV (${email})`,
      );
    }

    seenEmails.add(email);
  }

  return rows;
}

export async function createPlayerAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const parsed = playerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    gender: formData.get("gender"),
    status: formData.get("status") ?? "activo",
    level: formData.get("level") ?? "",
    initialPoints: formData.get("initialPoints") ?? 0,
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const payload = {
    fullName: parsed.data.fullName,
    email: normalizeOptional(parsed.data.email),
    gender: parsed.data.gender,
    status: parsed.data.status,
    level:
      parsed.data.level && parsed.data.level.length > 0
        ? parsed.data.level
        : null,
    initialPoints: parsed.data.initialPoints,
    notes: normalizeOptional(parsed.data.notes),
  };

  const [player] = await dbClient
    .insert(players)
    .values(payload)
    .returning({ id: players.id });

  await dbClient.insert(auditLog).values({
    actorId,
    action: "player.create",
    entityType: "player",
    entityId: player.id,
    payload,
  });

  await refreshHistoricalBestRanking(parsed.data.gender);
  revalidateTag("ranking", "max");
  revalidatePath("/admin/jugadores");
}

export async function importPlayersCsvAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const file = formData.get("csvFile");

  if (!(file instanceof File)) {
    throw new Error("Adjunta un archivo CSV");
  }

  const rows = parseSeedCsv(await file.text());
  const emails = rows
    .map((row) => row.email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  if (emails.length > 0) {
    const existing = await dbClient
      .select({ email: players.email })
      .from(players)
      .where(inArray(players.email, emails));

    if (existing.length > 0) {
      const duplicates = existing
        .map((row) => row.email)
        .filter((email): email is string => Boolean(email));
      throw new Error(
        `Ya existen jugadores con email: ${duplicates.join(", ")}`,
      );
    }
  }

  const inserted = await dbClient
    .insert(players)
    .values(
      rows.map((row) => ({
        fullName: row.fullName,
        email: normalizeOptional(row.email),
        gender: row.gender,
        status: "activo" as const,
        initialPoints: row.initialPoints,
        notes: normalizeOptional(row.notes),
      })),
    )
    .returning({
      id: players.id,
      fullName: players.fullName,
      initialPoints: players.initialPoints,
    });

  const byName = new Map(inserted.map((player) => [player.fullName, player]));
  const seedEvents = rows.flatMap((row) => {
    if (row.initialPoints <= 0) {
      return [];
    }

    const player = byName.get(row.fullName);

    if (!player) {
      return [];
    }

    return [
      {
        playerId: player.id,
        delta: row.initialPoints,
        reason: "initial_seed" as const,
        note: row.notes?.trim()
          ? `Seed inicial CSV · ${row.notes.trim()}`
          : "Seed inicial CSV",
        registeredById: actorId,
      },
    ];
  });

  if (seedEvents.length > 0) {
    await dbClient.insert(rankingEvents).values(seedEvents);
  }

  await dbClient.insert(auditLog).values({
    actorId,
    action: "player.import_csv",
    entityType: "player_batch",
    payload: {
      count: rows.length,
      withSeedEvents: seedEvents.length,
      sourceFile: file.name,
    },
  });

  const categories = new Set(rows.map((row) => row.gender));
  for (const category of categories) {
    await refreshHistoricalBestRanking(category);
  }

  revalidateTag("ranking", "max");
  revalidatePath("/admin/jugadores");
}

export async function updatePlayerAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const playerId = z.string().uuid().parse(formData.get("playerId"));
  const parsed = playerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    gender: formData.get("gender"),
    status: formData.get("status"),
    level: formData.get("level") ?? "",
    initialPoints: formData.get("initialPoints") ?? 0,
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const payload = {
    fullName: parsed.data.fullName,
    email: normalizeOptional(parsed.data.email),
    gender: parsed.data.gender,
    status: parsed.data.status,
    level:
      parsed.data.level && parsed.data.level.length > 0
        ? parsed.data.level
        : null,
    initialPoints: parsed.data.initialPoints,
    notes: normalizeOptional(parsed.data.notes),
    updatedAt: new Date(),
  };

  await dbClient.update(players).set(payload).where(eq(players.id, playerId));

  await dbClient.insert(auditLog).values({
    actorId,
    action: "player.update",
    entityType: "player",
    entityId: playerId,
    payload,
  });

  await refreshHistoricalBestRanking(parsed.data.gender);
  revalidateTag("ranking", "max");
  revalidatePath("/admin/jugadores");
}

export async function approvePlayerAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const playerId = z.string().uuid().parse(formData.get("playerId"));

  await dbClient
    .update(players)
    .set({ status: "activo", updatedAt: new Date() })
    .where(eq(players.id, playerId));

  await dbClient.insert(auditLog).values({
    actorId,
    action: "player.approve",
    entityType: "player",
    entityId: playerId,
    payload: { status: "activo" },
  });

  revalidatePath("/admin/jugadores");
}

export async function toggleRetiredPlayerAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const playerId = z.string().uuid().parse(formData.get("playerId"));
  const nextStatus = z
    .enum(["activo", "retirado"])
    .parse(formData.get("nextStatus"));

  await dbClient
    .update(players)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(players.id, playerId)));

  await dbClient.insert(auditLog).values({
    actorId,
    action: nextStatus === "retirado" ? "player.retire" : "player.reactivate",
    entityType: "player",
    entityId: playerId,
    payload: { status: nextStatus },
  });

  revalidatePath("/admin/jugadores");
}
