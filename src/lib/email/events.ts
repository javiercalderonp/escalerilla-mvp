import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailEvents } from "@/lib/db/schema";

export type EmailEventType =
  | "availability_reminder"
  | "fixture_published"
  | "match_result"
  | "welcome"
  | "inactivity_warning"
  | "challenge";

export function makeEmailDedupeKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => part ?? "none").join(":");
}

export async function reserveEmailEvent(args: {
  type: EmailEventType;
  dedupeKey: string;
  recipientEmail: string;
  playerId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  if (!db) {
    return true;
  }

  const [existing] = await db
    .select({ status: emailEvents.status })
    .from(emailEvents)
    .where(eq(emailEvents.dedupeKey, args.dedupeKey))
    .limit(1);

  if (existing?.status === "sent" || existing?.status === "pending") {
    return false;
  }

  if (existing?.status === "failed") {
    await db
      .update(emailEvents)
      .set({
        status: "pending",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(emailEvents.dedupeKey, args.dedupeKey));

    return true;
  }

  const inserted = await db
    .insert(emailEvents)
    .values({
      type: args.type,
      dedupeKey: args.dedupeKey,
      recipientEmail: args.recipientEmail,
      playerId: args.playerId ?? null,
      entityType: args.entityType ?? null,
      entityId: args.entityId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: emailEvents.id });

  return inserted.length > 0;
}

export async function markEmailEventSent(dedupeKey: string) {
  if (!db) {
    return;
  }

  await db
    .update(emailEvents)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(emailEvents.dedupeKey, dedupeKey));
}

export async function markEmailEventFailed(dedupeKey: string, error: unknown) {
  if (!db) {
    return;
  }

  await db
    .update(emailEvents)
    .set({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      updatedAt: new Date(),
    })
    .where(eq(emailEvents.dedupeKey, dedupeKey));
}
