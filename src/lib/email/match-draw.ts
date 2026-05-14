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
  escapeHtml,
  sendTransactionalEmail,
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
    .map((line) => `<li>${escapeHtml(line)}</li>`)
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
  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>Hola ${escapeHtml(args.player.fullName)},</p>`,
    `<p>Semana: ${escapeHtml(formatDate(args.weekStartsOn))} al ${escapeHtml(formatDate(args.weekEndsOn))}.</p>`,
    `<h2>Horarios disponibles de ${escapeHtml(args.opponent.fullName)}</h2>`,
    `<ul>${formatAvailabilityHtml(args.opponent)}</ul>`,
    "<h2>Tus horarios cargados</h2>",
    `<ul>${formatAvailabilityHtml(args.player)}</ul>`,
    `<p><a href="${escapeHtml(fixtureUrl)}">Ver fixture</a></p>`,
  ].join("\n");

  return {
    subject: title,
    text: textLines.join("\n"),
    html,
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

  const results = await Promise.all(
    deliveries.map((delivery) =>
      sendDrawEmail({
        ...delivery,
        weekStartsOn: week.startsOn,
        weekEndsOn: week.endsOn,
      }),
    ),
  );

  return {
    sent: results.filter((result) => result === "sent").length,
    skipped: results.filter((result) => result === "skipped").length,
    failed: results.filter((result) => result === "failed").length,
  };
}
