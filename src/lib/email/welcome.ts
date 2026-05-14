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
  buildEmailLayout,
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
  const innerHtml = `
<h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#0d1b2a;line-height:1.3;">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;color:#0d1b2a;line-height:1.6;">Hola <strong>${escapeHtml(playerName)}</strong>,</p>
<p style="margin:0 0 24px;font-size:15px;color:#0d1b2a;line-height:1.6;">Tu perfil ya quedó listo para participar en las competencias semanales.</p>
<div style="background-color:#f6f2ea;border-radius:8px;border:1px solid #ded6ca;padding:20px 24px;margin:0 0 28px;">
  <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Para participar cada semana</p>
  <p style="margin:0 0 10px;font-size:14px;color:#0d1b2a;line-height:1.5;">1. <a href="${escapeHtml(availabilityUrl)}" style="color:#0d1b2a;font-weight:600;">Confirma tu disponibilidad</a> — indicá cuándo podés jugar.</p>
  <p style="margin:0 0 10px;font-size:14px;color:#0d1b2a;line-height:1.5;">2. <a href="${escapeHtml(fixtureUrl)}" style="color:#0d1b2a;font-weight:600;">Revisá tus partidos</a> — una vez publicado el sorteo.</p>
  <p style="margin:0;font-size:14px;color:#0d1b2a;line-height:1.5;">3. <a href="${escapeHtml(resultUrl)}" style="color:#0d1b2a;font-weight:600;">Subí tus resultados</a> — cuando termines de jugar.</p>
</div>
<a href="${escapeHtml(availabilityUrl)}" style="display:inline-block;padding:13px 28px;background-color:#0d1b2a;color:#fffdfa;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;line-height:1;">Confirmar disponibilidad</a>
<hr style="border:none;border-top:1px solid #ded6ca;margin:28px 0 20px;">
<p style="margin:0;font-size:13px;color:#776f66;line-height:1.6;"><a href="${escapeHtml(rulesUrl)}" style="color:#776f66;">Ver reglamento del club</a></p>`;

  return {
    subject: title,
    text: textLines.join("\n"),
    html: buildEmailLayout(title, innerHtml),
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
