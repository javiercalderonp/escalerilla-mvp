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
  buildEmailLayout,
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
  const innerHtml = `
<h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#0d1b2a;line-height:1.3;">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;color:#0d1b2a;line-height:1.6;">Hola <strong>${escapeHtml(args.challengedName)}</strong>,</p>
<p style="margin:0 0 24px;font-size:15px;color:#0d1b2a;line-height:1.6;"><strong>${escapeHtml(args.challengerName)}</strong> te ha desafiado a un partido. Coordinen para jugar lo antes posible.</p>
<div style="background-color:#f6f2ea;border-radius:8px;border:1px solid #ded6ca;padding:20px 24px;margin:0 0 28px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Tu rival</p>
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0d1b2a;">${escapeHtml(args.challengerName)}</p>
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Fecha límite</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#0d1b2a;">${escapeHtml(deadline)}</p>
</div>
<a href="${escapeHtml(fixtureUrl)}" style="display:inline-block;padding:13px 28px;background-color:#0d1b2a;color:#fffdfa;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;line-height:1;">Ver partido</a>`;

  return {
    subject: title,
    text: textLines.join("\n"),
    html: buildEmailLayout(title, innerHtml),
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
