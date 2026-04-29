"use server";

import { and, count, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog, freezes, seasons, users } from "@/lib/db/schema";

const createFreezeSchema = z.object({
  playerId: z.string().uuid(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable()
    .optional(),
  reason: z.string().min(3, "Motivo requerido").max(500),
});

async function requireAdminActor() {
  const session = await auth();
  if (!session?.user?.email || session.user.role !== "admin") {
    throw new Error("No autorizado");
  }
  if (!db) throw new Error("Base de datos no configurada");
  const [actor] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1);
  return { actorId: actor?.id ?? null, dbClient: db };
}

function semesterBounds(startsOn: string): { start: string; end: string } {
  const year = startsOn.slice(0, 4);
  const month = parseInt(startsOn.slice(5, 7), 10);
  return month <= 6
    ? { start: `${year}-01-01`, end: `${year}-06-30` }
    : { start: `${year}-07-01`, end: `${year}-12-31` };
}

export async function createFreezeAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const raw = {
    playerId: formData.get("playerId"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn") || null,
    reason: formData.get("reason"),
  };

  const parsed = createFreezeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const [activeSeason] = await dbClient
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, "activa"))
    .limit(1);

  if (!activeSeason) throw new Error("No hay temporada activa");

  const { start, end } = semesterBounds(parsed.data.startsOn);

  const [countRow] = await dbClient
    .select({ value: count() })
    .from(freezes)
    .where(
      and(
        eq(freezes.playerId, parsed.data.playerId),
        eq(freezes.seasonId, activeSeason.id),
        gte(freezes.startsOn, start),
        lte(freezes.startsOn, end),
      ),
    );

  if ((countRow?.value ?? 0) >= 3) {
    throw new Error(
      "Este jugador ya tiene 3 congelaciones en el semestre (RN-09)",
    );
  }

  if (
    parsed.data.endsOn &&
    parsed.data.endsOn < parsed.data.startsOn
  ) {
    throw new Error("La fecha de fin no puede ser anterior al inicio");
  }

  const [freeze] = await dbClient
    .insert(freezes)
    .values({
      playerId: parsed.data.playerId,
      seasonId: activeSeason.id,
      startsOn: parsed.data.startsOn,
      endsOn: parsed.data.endsOn ?? null,
      reason: parsed.data.reason,
      createdById: actorId,
    })
    .returning({ id: freezes.id });

  await dbClient.insert(auditLog).values({
    actorId,
    action: "freeze.create",
    entityType: "freeze",
    entityId: freeze.id,
    payload: parsed.data,
  });

  revalidatePath("/admin/congelaciones");
}
