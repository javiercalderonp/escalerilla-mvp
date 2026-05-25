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

export function buildWelcomeEmail(playerName: string) {
  const availabilityUrl = absoluteUrl("/disponibilidad");
  const fixtureUrl = absoluteUrl("/fixture");
  const resultUrl = absoluteUrl("/ingresar-resultado");
  const profileUrl = absoluteUrl("/mi-perfil");
  const title = "Bienvenido a la Escalerilla";
  const textLines = [
    `Hola ${playerName},`,
    "",
    "Ya formas parte de la Escalerilla. Tu perfil ya quedó listo.",
    "",
    "Así funciona:",
    `1. Confirma tu disponibilidad: ${availabilityUrl}`,
    `2. Revisa tus partidos publicados: ${fixtureUrl}`,
    `3. Sube tus resultados cuando termines de jugar: ${resultUrl}`,
    "",
    `Ver mi perfil: ${profileUrl}`,
  ];
  const innerHtml = `
<div class="em-email-heading" style="text-align:center;margin:0 0 28px;">
  <p class="em-email-icon" style="margin:0 0 16px;font-size:28px;line-height:1;">&#127934;</p>
  <h1 class="em-email-title" style="margin:0;font-size:28px;font-weight:800;color:#0d1b2a;line-height:1.2;">${escapeHtml(title)}</h1>
  <div class="em-email-rule" style="width:40px;height:3px;background-color:#e8720c;margin:14px auto 0;"></div>
</div>
<p class="em-email-greeting" style="margin:0 0 8px;font-size:15px;color:#0d1b2a;line-height:1.6;text-align:center;">Hola <strong>${escapeHtml(playerName)}</strong>,</p>
<p class="em-email-intro" style="margin:0 0 32px;font-size:15px;color:#776f66;line-height:1.6;text-align:center;">Ya formas parte de la Escalerilla de Tenis.<br>Prepárate para competir, mejorar tu ranking y disfrutar cada semana.</p>
<p class="em-email-section-label" style="margin:0 0 20px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.1em;text-align:center;">Así funciona</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 32px;">
  <tr>
    <td width="33%" align="center" valign="top" style="padding:0 8px;">
      <div class="em-email-icon-card" style="width:60px;height:60px;background-color:#f0ede8;border-radius:50%;margin:0 auto 12px;text-align:center;font-size:26px;line-height:60px;">&#128197;</div>
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0d1b2a;line-height:1.4;text-align:center;">1. Confirma tu disponibilidad</p>
      <p style="margin:0;font-size:13px;color:#776f66;line-height:1.5;text-align:center;">Indica cuándo puedes jugar cada semana.</p>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 8px;">
      <div class="em-email-icon-card" style="width:60px;height:60px;background-color:#f0ede8;border-radius:50%;margin:0 auto 12px;text-align:center;font-size:26px;line-height:60px;">&#127934;</div>
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0d1b2a;line-height:1.4;text-align:center;">2. Revisa tus partidos</p>
      <p style="margin:0;font-size:13px;color:#776f66;line-height:1.5;text-align:center;">Una vez publicado el sorteo, conocé tu próximo desafío.</p>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 8px;">
      <div class="em-email-icon-card" style="width:60px;height:60px;background-color:#f0ede8;border-radius:50%;margin:0 auto 12px;text-align:center;font-size:26px;line-height:60px;">&#127942;</div>
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0d1b2a;line-height:1.4;text-align:center;">3. Sube tus resultados</p>
      <p style="margin:0;font-size:13px;color:#776f66;line-height:1.5;text-align:center;">Reporta el resultado al terminar tu partido.</p>
    </td>
  </tr>
</table>
<hr style="border:none;border-top:1px solid #ede8e2;margin:0 0 28px;">
<div style="text-align:center;margin:0 0 16px;">
  <a href="${escapeHtml(availabilityUrl)}" class="em-email-action" style="display:inline-block;padding:15px 40px;background-color:#e8720c;color:#ffffff;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;line-height:1;">Confirmar disponibilidad</a>
</div>
<div style="text-align:center;">
  <a href="${escapeHtml(profileUrl)}" style="font-size:14px;color:#0d1b2a;text-decoration:underline;">Ir a mi perfil</a>
</div>`;

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
    const message = buildWelcomeEmail(player.fullName);

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
