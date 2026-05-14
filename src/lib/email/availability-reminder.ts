import { asc, eq } from "drizzle-orm";

import { getTodayInSantiago } from "@/lib/date";
import { db } from "@/lib/db";
import { availability, players, weeks } from "@/lib/db/schema";
import {
  makeEmailDedupeKey,
  markEmailEventFailed,
  markEmailEventSent,
  reserveEmailEvent,
} from "@/lib/email/events";
import {
  absoluteUrl,
  escapeHtml,
  sendTransactionalEmail,
  uniqueRecipients,
} from "@/lib/email/shared";
import { env } from "@/lib/env";

type ReminderTarget = {
  id: string;
  fullName: string;
  email: string;
};

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getNextMonday(today: string) {
  const date = parseDate(today);
  const day = date.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;

  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return date.toISOString().slice(0, 10);
}

function buildMessage(args: {
  playerName: string;
  weekStartsOn: string;
  weekEndsOn: string;
  deadline: string;
}) {
  const availabilityUrl = absoluteUrl("/disponibilidad");
  const title = "Confirma tu disponibilidad para la próxima semana";
  const textLines = [
    `Hola ${args.playerName},`,
    "",
    "Aún no has confirmado si puedes jugar la próxima semana.",
    `Semana: ${formatDate(args.weekStartsOn)} al ${formatDate(args.weekEndsOn)}.`,
    `Por favor márcalo antes del viernes (${formatDate(args.deadline)}).`,
    "",
    `Confirmar disponibilidad: ${availabilityUrl}`,
  ];
  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>Hola ${escapeHtml(args.playerName)},</p>`,
    "<p>Aún no has confirmado si puedes jugar la próxima semana.</p>",
    `<p>Semana: ${escapeHtml(formatDate(args.weekStartsOn))} al ${escapeHtml(formatDate(args.weekEndsOn))}.</p>`,
    `<p>Por favor márcalo antes del viernes (${escapeHtml(formatDate(args.deadline))}).</p>`,
    `<p><a href="${escapeHtml(availabilityUrl)}">Confirmar disponibilidad</a></p>`,
  ].join("\n");

  return {
    subject: title,
    text: textLines.join("\n"),
    html,
  };
}

async function loadReminderTargets() {
  const dbClient = db;

  if (!dbClient) {
    return null;
  }

  const today = getTodayInSantiago();
  const fallbackStartsOn = getNextMonday(today);
  const fallbackEndsOn = addDays(fallbackStartsOn, 6);
  const fallbackDeadline = addDays(fallbackStartsOn, -3);

  const [targetWeek] = await dbClient
    .select({
      id: weeks.id,
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
    })
    .from(weeks)
    .where(eq(weeks.startsOn, fallbackStartsOn))
    .orderBy(asc(weeks.startsOn))
    .limit(1);

  const activePlayers = await dbClient
    .select({
      id: players.id,
      fullName: players.fullName,
      email: players.email,
      wantsToPlayNextWeek: players.wantsToPlayNextWeek,
    })
    .from(players)
    .where(eq(players.status, "activo"));

  const playersWithWeekAvailability = targetWeek
    ? await dbClient
        .select({ playerId: availability.playerId })
        .from(availability)
        .where(eq(availability.weekId, targetWeek.id))
    : [];
  const availablePlayerIds = new Set(
    playersWithWeekAvailability.map((row) => row.playerId),
  );

  const targets = uniqueRecipients(
    activePlayers
      .filter(
        (player) =>
          !player.wantsToPlayNextWeek && !availablePlayerIds.has(player.id),
      )
      .map((player) => ({
        email: player.email ?? "",
        kind: "player" as const,
        playerId: player.id,
        name: player.fullName,
      })),
  ).map(
    (recipient): ReminderTarget => ({
      id: recipient.playerId ?? "",
      fullName: recipient.name ?? "",
      email: recipient.email,
    }),
  );

  return {
    targets: targets.filter((target) => target.id),
    weekId: targetWeek?.id ?? null,
    weekStartsOn: targetWeek?.startsOn ?? fallbackStartsOn,
    weekEndsOn: targetWeek?.endsOn ?? fallbackEndsOn,
    deadline: targetWeek?.startsOn
      ? addDays(targetWeek.startsOn, -3)
      : fallbackDeadline,
  };
}

export async function sendAvailabilityReminders() {
  if (!env.emailsEnabled) {
    return { sent: 0, skipped: 0, failed: 0, reason: "emails_disabled" };
  }

  if (!env.resendApiKey || !env.emailFrom) {
    console.warn(
      "Email notifications are enabled but RESEND_API_KEY or EMAIL_FROM is missing.",
    );
    return { sent: 0, skipped: 0, failed: 0, reason: "email_env_missing" };
  }

  const data = await loadReminderTargets();

  if (!data) {
    return { sent: 0, skipped: 0, failed: 0, reason: "db_not_configured" };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    data.targets.map(async (target) => {
      const dedupeKey = makeEmailDedupeKey([
        "availability_reminder",
        data.weekStartsOn,
        target.id,
      ]);
      const reserved = await reserveEmailEvent({
        type: "availability_reminder",
        dedupeKey,
        recipientEmail: target.email,
        playerId: target.id,
        entityType: data.weekId ? "week" : "week_start",
        entityId: data.weekId,
      });

      if (!reserved) {
        skipped += 1;
        return;
      }

      try {
        const message = buildMessage({
          playerName: target.fullName,
          weekStartsOn: data.weekStartsOn,
          weekEndsOn: data.weekEndsOn,
          deadline: data.deadline,
        });

        await sendTransactionalEmail({
          to: target.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        await markEmailEventSent(dedupeKey);
        sent += 1;
      } catch (error) {
        await markEmailEventFailed(dedupeKey, error);
        failed += 1;
        console.error("Failed to send availability reminder email", error);
      }
    }),
  );

  return {
    sent,
    skipped,
    failed,
    totalTargets: data.targets.length,
    weekStartsOn: data.weekStartsOn,
    weekEndsOn: data.weekEndsOn,
    deadline: data.deadline,
  };
}
