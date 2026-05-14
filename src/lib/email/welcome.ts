import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";
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

function buildMessage(playerName: string) {
  const availabilityUrl = absoluteUrl("/disponibilidad");
  const fixtureUrl = absoluteUrl("/fixture");
  const resultUrl = absoluteUrl("/ingresar-resultado");
  const rulesUrl = absoluteUrl("/reglamento");
  const title = "Bienvenido al club";
  const textLines = [
    `Hola ${playerName},`,
    "",
    "Bienvenido al club. Tu perfil ya quedó listo.",
    "",
    "Para participar cada semana:",
    `1. Confirma tu disponibilidad: ${availabilityUrl}`,
    `2. Revisa tus partidos publicados: ${fixtureUrl}`,
    `3. Sube tus resultados cuando termines de jugar: ${resultUrl}`,
    "",
    `Reglamento: ${rulesUrl}`,
  ];
  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>Hola ${escapeHtml(playerName)},</p>`,
    "<p>Bienvenido al club. Tu perfil ya quedó listo.</p>",
    "<p>Para participar cada semana:</p>",
    "<ul>",
    `<li><a href="${escapeHtml(availabilityUrl)}">Confirma tu disponibilidad</a></li>`,
    `<li><a href="${escapeHtml(fixtureUrl)}">Revisa tus partidos publicados</a></li>`,
    `<li><a href="${escapeHtml(resultUrl)}">Sube tus resultados cuando termines de jugar</a></li>`,
    "</ul>",
    `<p><a href="${escapeHtml(rulesUrl)}">Ver reglamento</a></p>`,
  ].join("\n");

  return {
    subject: title,
    text: textLines.join("\n"),
    html,
  };
}

export async function notifyWelcomeEmail(playerId: string) {
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

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      email: players.email,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  const email = player?.email?.trim().toLowerCase();

  if (!player || !email) {
    return { sent: 0, skipped: 1, failed: 0 };
  }

  const dedupeKey = makeEmailDedupeKey(["welcome", player.id]);
  const reserved = await reserveEmailEvent({
    type: "welcome",
    dedupeKey,
    recipientEmail: email,
    playerId: player.id,
    entityType: "player",
    entityId: player.id,
  });

  if (!reserved) {
    return { sent: 0, skipped: 1, failed: 0 };
  }

  try {
    const message = buildMessage(player.fullName);

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
