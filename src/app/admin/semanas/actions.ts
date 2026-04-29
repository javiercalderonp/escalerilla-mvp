"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog, seasons, users, weeks } from "@/lib/db/schema";

async function requireAdminActor() {
  const session = await auth();

  if (!session?.user?.email || session.user.role !== "admin") {
    throw new Error("No autorizado");
  }

  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const [actor] = await dbClient
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1);

  return { actorId: actor?.id ?? null, dbClient };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getActiveSeason(dbClient: NonNullable<typeof db>) {
  const [season] = await dbClient
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, "activa"))
    .limit(1);
  return season ?? null;
}

export async function createWeekAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const startsOn = z.string().date().parse(formData.get("startsOn"));
  const endsOn = addDays(startsOn, 6);

  const season = await getActiveSeason(dbClient);
  if (!season) {
    throw new Error("No hay temporada activa");
  }

  const [week] = await dbClient
    .insert(weeks)
    .values({
      seasonId: season.id,
      startsOn,
      endsOn,
      status: "borrador",
      createdById: actorId,
    })
    .returning({ id: weeks.id });

  await dbClient.insert(auditLog).values({
    actorId,
    action: "week.create",
    entityType: "week",
    entityId: week.id,
    payload: { startsOn, endsOn },
  });

  revalidatePath("/admin/semanas");
}

export async function openAvailabilityAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const weekId = z.string().uuid().parse(formData.get("weekId"));

  await dbClient
    .update(weeks)
    .set({
      status: "abierta",
      availabilityOpensAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(weeks.id, weekId), eq(weeks.status, "borrador")));

  await dbClient.insert(auditLog).values({
    actorId,
    action: "week.open_availability",
    entityType: "week",
    entityId: weekId,
    payload: {},
  });

  revalidatePath("/admin/semanas");
  revalidatePath(`/admin/semanas/${weekId}`);
}

export async function closeAvailabilityAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const weekId = z.string().uuid().parse(formData.get("weekId"));

  await dbClient
    .update(weeks)
    .set({
      status: "cerrada",
      availabilityClosesAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(weeks.id, weekId), eq(weeks.status, "abierta")));

  await dbClient.insert(auditLog).values({
    actorId,
    action: "week.close_availability",
    entityType: "week",
    entityId: weekId,
    payload: {},
  });

  revalidatePath("/admin/semanas");
  revalidatePath(`/admin/semanas/${weekId}`);
}
