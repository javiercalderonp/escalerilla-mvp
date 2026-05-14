import { and, eq, inArray } from "drizzle-orm";

import {
  AVAILABILITY_DAYS,
  buildAvailabilitySlots,
  summarizeAvailabilityDay,
} from "@/lib/availability";
import { db } from "@/lib/db";
import { matches, players, weeks } from "@/lib/db/schema";
import {
  makeEmailDedupeKey,
  markEmailEventFailed,
  markEmailEventSent,
  reserveEmailEvent,
} from "@/lib/email/events";
import {
  absoluteUrl,
  buildEmailLayout,
  escapeHtml,
  sendTransactionalEmail,
  wait,
} from "@/lib/email/shared";
import { env } from "@/lib/env";

type DrawPlayer = {
  id: string;
  fullName: string;
  email: string | null;
  availMonday: boolean | null;
  availTuesday: boolean | null;
  availWednesday: boolean | null;
  availThursday: boolean | null;
  availFriday: boolean | null;
  availSaturday: boolean | null;
  availSunday: boolean | null;
  alwaysAvailable: boolean;
  visibility: {
    availabilitySlots?: unknown;
  } | null;
};

type DrawMatch = {
  id: string;
  player1Id: string;
  player2Id: string;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function formatAvailability(player: DrawPlayer) {
  if (player.alwaysAvailable) {
    return "Puede jugar en cualquier horario.";
  }

  const slots = buildAvailabilitySlots(player);
  const lines = AVAILABILITY_DAYS.map(({ key, label }) => {
    const summary = summarizeAvailabilityDay(slots[key]);
    return summary ? `${label}: ${summary}` : null;
  }).filter((line): line is string => Boolean(line));

  return lines.length > 0
    ? lines.join("\n")
    : "No tiene horarios detallados cargados.";
}

function formatAvailabilityHtml(player: DrawPlayer) {
  return formatAvailability(player)
    .split("\n")
    .map(
      (line) =>
        `<li style="padding:5px 0;font-size:14px;color:#0d1b2a;line-height:1.5;border-bottom:1px solid #ded6ca;">${escapeHtml(line)}</li>`,
    )
    .join("\n");
}

function buildMessage(args: {
  player: DrawPlayer;
  opponent: DrawPlayer;
  match: DrawMatch;
  weekStartsOn: string;
  weekEndsOn: string;
}) {
  const fixtureUrl = absoluteUrl("/fixture");
  const title = `Tienes partido contra ${args.opponent.fullName}`;
  const opponentAvailability = formatAvailability(args.opponent);
  const playerAvailability = formatAvailability(args.player);
  const textLines = [
    `Hola ${args.player.fullName},`,
    "",
    title,
    `Semana: ${formatDate(args.weekStartsOn)} al ${formatDate(args.weekEndsOn)}.`,
    "",
    `Horarios disponibles de ${args.opponent.fullName}:`,
    opponentAvailability,
    "",
    "Tus horarios cargados:",
    playerAvailability,
    "",
    `Ver fixture: ${fixtureUrl}`,
  ];
  const innerHtml = `
<h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#0d1b2a;line-height:1.3;">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;color:#0d1b2a;line-height:1.6;">Hola <strong>${escapeHtml(args.player.fullName)}</strong>,</p>
<div style="background-color:#f6f2ea;border-radius:8px;border:1px solid #ded6ca;padding:20px 24px;margin:0 0 28px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Semana</p>
  <p style="margin:0;font-size:15px;font-weight:700;color:#0d1b2a;">${escapeHtml(formatDate(args.weekStartsOn))} al ${escapeHtml(formatDate(args.weekEndsOn))}</p>
</div>
<h2 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Disponibilidad de ${escapeHtml(args.opponent.fullName)}</h2>
<ul style="margin:0 0 24px;padding:0;list-style:none;border-top:1px solid #ded6ca;">
  ${formatAvailabilityHtml(args.opponent)}
</ul>
<h2 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Tus horarios cargados</h2>
<ul style="margin:0 0 28px;padding:0;list-style:none;border-top:1px solid #ded6ca;">
  ${formatAvailabilityHtml(args.player)}
</ul>
<a href="${escapeHtml(fixtureUrl)}" style="display:inline-block;padding:13px 28px;background-color:#0d1b2a;color:#fffdfa;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;line-height:1;">Ver fixture</a>`;

  return {
    subject: title,
    text: textLines.join("\n"),
    html: buildEmailLayout(title, innerHtml),
  };
}

async function sendDrawEmail(args: {
  player: DrawPlayer;
  opponent: DrawPlayer;
  match: DrawMatch;
  weekStartsOn: string;
  weekEndsOn: string;
}) {
  const email = args.player.email?.trim().toLowerCase();

  if (!email) {
    return "skipped" as const;
  }

  const dedupeKey = makeEmailDedupeKey([
    "fixture_published",
    args.match.id,
    args.player.id,
  ]);
  const reserved = await reserveEmailEvent({
    type: "fixture_published",
    dedupeKey,
    recipientEmail: email,
    playerId: args.player.id,
    entityType: "match",
    entityId: args.match.id,
  });

  if (!reserved) {
    return "skipped" as const;
  }

  try {
    const message = buildMessage(args);

    await sendTransactionalEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    await markEmailEventSent(dedupeKey);
    return "sent" as const;
  } catch (error) {
    await markEmailEventFailed(dedupeKey, error);
    console.error("Failed to send fixture published email", error);
    return "failed" as const;
  }
}

export async function notifyFixturePublished(weekId: string) {
  if (!env.emailsEnabled) {
    return { sent: 0, skipped: 0, failed: 0, reason: "emails_disabled" };
  }

  if (!env.resendApiKey || !env.emailFrom) {
    console.warn(
      "Email notifications are enabled but RESEND_API_KEY or EMAIL_FROM is missing.",
    );
    return { sent: 0, skipped: 0, failed: 0, reason: "email_env_missing" };
  }

  if (!db) {
    return { sent: 0, skipped: 0, failed: 0, reason: "db_not_configured" };
  }

  const [week] = await db
    .select({
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
    })
    .from(weeks)
    .where(eq(weeks.id, weekId))
    .limit(1);

  if (!week) {
    return { sent: 0, skipped: 0, failed: 0, reason: "week_not_found" };
  }

  const drawMatches = await db
    .select({
      id: matches.id,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
    })
    .from(matches)
    .where(
      and(
        eq(matches.weekId, weekId),
        eq(matches.type, "sorteo"),
        eq(matches.status, "pendiente"),
      ),
    );

  const playerIds = [
    ...new Set(
      drawMatches.flatMap((match) => [match.player1Id, match.player2Id]),
    ),
  ];

  if (playerIds.length === 0) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const matchPlayers = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      email: players.email,
      availMonday: players.availMonday,
      availTuesday: players.availTuesday,
      availWednesday: players.availWednesday,
      availThursday: players.availThursday,
      availFriday: players.availFriday,
      availSaturday: players.availSaturday,
      availSunday: players.availSunday,
      alwaysAvailable: players.alwaysAvailable,
      visibility: players.visibility,
    })
    .from(players)
    .where(inArray(players.id, playerIds));
  const playersById = new Map(
    matchPlayers.map((player) => [player.id, player]),
  );
  const deliveries = drawMatches.flatMap((match) => {
    const player1 = playersById.get(match.player1Id);
    const player2 = playersById.get(match.player2Id);

    if (!player1 || !player2) {
      return [];
    }

    return [
      { player: player1, opponent: player2, match },
      { player: player2, opponent: player1, match },
    ];
  });

  const testDeliveries = env.emailTestRecipient
    ? deliveries.slice(0, 1)
    : deliveries;
  const results = [];

  for (const delivery of testDeliveries) {
    await wait(250);
    results.push(
      await sendDrawEmail({
        ...delivery,
        weekStartsOn: week.startsOn,
        weekEndsOn: week.endsOn,
      }),
    );
  }

  return {
    sent: results.filter((result) => result === "sent").length,
    skipped: results.filter((result) => result === "skipped").length,
    failed: results.filter((result) => result === "failed").length,
    suppressed: deliveries.length - testDeliveries.length,
  };
}
