import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { matches, players } from "@/lib/db/schema";
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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).split("-").reverse().join("-");
}

function buildMessage(args: {
  challengedName: string;
  challengerName: string;
  deadline: Date;
}) {
  const fixtureUrl = absoluteUrl("/fixture");
  const title = "Te han desafiado a un partido";
  const deadline = formatDate(args.deadline);
  const textLines = [
    `Hola ${args.challengedName},`,
    "",
    `Te han desafiado a un partido. Tu rival es ${args.challengerName}.`,
    `Coordina con él para jugar antes de ${deadline}.`,
    "",
    `Ver partido: ${fixtureUrl}`,
  ];
  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>Hola ${escapeHtml(args.challengedName)},</p>`,
    `<p>Te han desafiado a un partido. Tu rival es ${escapeHtml(args.challengerName)}.</p>`,
    `<p>Coordina con él para jugar antes de ${escapeHtml(deadline)}.</p>`,
    `<p><a href="${escapeHtml(fixtureUrl)}">Ver partido</a></p>`,
  ].join("\n");

  return {
    subject: title,
    text: textLines.join("\n"),
    html,
  };
}

export async function notifyChallengeCreated(matchId: string) {
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

  const [match] = await db
    .select({
      id: matches.id,
      type: matches.type,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match || match.type !== "desafio") {
    return { sent: 0, skipped: 1, failed: 0 };
  }

  const [challengerRows, challengedRows] = await Promise.all([
    db
      .select({
        fullName: players.fullName,
      })
      .from(players)
      .where(eq(players.id, match.player1Id))
      .limit(1),
    db
      .select({
        id: players.id,
        fullName: players.fullName,
        email: players.email,
      })
      .from(players)
      .where(eq(players.id, match.player2Id))
      .limit(1),
  ]);
  const challenger = challengerRows[0];
  const challenged = challengedRows[0];
  const email = challenged?.email?.trim().toLowerCase();

  if (!challenger || !challenged || !email) {
    return { sent: 0, skipped: 1, failed: 0 };
  }

  const dedupeKey = makeEmailDedupeKey(["challenge", match.id, challenged.id]);
  const reserved = await reserveEmailEvent({
    type: "challenge",
    dedupeKey,
    recipientEmail: email,
    playerId: challenged.id,
    entityType: "match",
    entityId: match.id,
  });

  if (!reserved) {
    return { sent: 0, skipped: 1, failed: 0 };
  }

  try {
    const deadline = new Date(match.createdAt);
    deadline.setDate(deadline.getDate() + 7);
    const message = buildMessage({
      challengedName: challenged.fullName,
      challengerName: challenger.fullName,
      deadline,
    });

    await sendTransactionalEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    await markEmailEventSent(dedupeKey);
    return { sent: 1, skipped: 0, failed: 0 };
  } catch (error) {
    await markEmailEventFailed(dedupeKey, error);
    throw error;
  }
}
