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

export type InactivityWarningTarget = {
  playerId: string;
  fullName: string;
  email: string | null;
  daysSince: number;
  lastMatchDate: string | null;
};

export function buildInactivityWarningEmail(target: InactivityWarningTarget) {
  const fixtureUrl = absoluteUrl("/fixture");
  const title = "Advertencia de inactividad";
  const textLines = [
    `Hola ${target.fullName},`,
    "",
    `Llevas ${target.daysSince} días sin jugar.`,
    "Si no juegas pronto, perderás 40 puntos por inactividad.",
    "",
    "¡Agenda tu partido esta semana!",
    `Ver partidos: ${fixtureUrl}`,
  ];
  const innerHtml = `
<div class="em-email-heading" style="text-align:center;margin:0 0 28px;">
  <p class="em-email-kicker" style="margin:0 0 12px;font-size:12px;font-weight:700;color:#e8720c;letter-spacing:0.1em;text-transform:uppercase;">&#9888;&#65039; AVISO DE INACTIVIDAD</p>
  <h1 class="em-email-title" style="margin:0;font-size:26px;font-weight:800;color:#0d1b2a;line-height:1.2;">${escapeHtml(title)}</h1>
  <div class="em-email-rule" style="width:40px;height:3px;background-color:#e8720c;margin:14px auto 0;"></div>
</div>
<p class="em-email-greeting" style="margin:0 0 20px;font-size:15px;color:#0d1b2a;line-height:1.6;text-align:center;">Hola <strong>${escapeHtml(target.fullName)}</strong>,</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #ede8e2;border-radius:8px;margin:0 0 24px;">
  <tr>
    <td style="padding:20px 24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.08em;">Días sin jugar</p>
      <p style="margin:0;font-size:48px;font-weight:900;color:#e8720c;line-height:1;">${target.daysSince}</p>
    </td>
  </tr>
</table>
<p class="em-email-intro" style="margin:0 0 16px;font-size:15px;color:#0d1b2a;line-height:1.6;text-align:center;">Si no juegas pronto, perderás <strong>40 puntos</strong> por inactividad.</p>
<p class="em-email-intro" style="margin:0 0 28px;font-size:15px;color:#776f66;line-height:1.6;text-align:center;">¡Agenda tu partido esta semana!</p>
<div style="text-align:center;">
  <a href="${escapeHtml(fixtureUrl)}" class="em-email-action" style="display:inline-block;padding:15px 40px;background-color:#e8720c;color:#ffffff;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;line-height:1;">Ver partidos</a>
</div>`;

  return {
    subject: title,
    text: textLines.join("\n"),
    html: buildEmailLayout(title, innerHtml),
  };
}

export async function sendInactivityWarningEmails(
  targets: InactivityWarningTarget[],
) {
  if (!env.emailsEnabled) {
    return { sent: 0, skipped: 0, failed: 0, reason: "emails_disabled" };
  }

  if (!env.resendApiKey || !env.emailFrom) {
    console.warn(
      "Email notifications are enabled but RESEND_API_KEY or EMAIL_FROM is missing.",
    );
    return { sent: 0, skipped: 0, failed: 0, reason: "email_env_missing" };
  }

  const testTargets = env.emailTestRecipient ? targets.slice(0, 1) : targets;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of testTargets) {
    await wait(250);
    const email = target.email?.trim().toLowerCase();

    if (!email) {
      skipped += 1;
      continue;
    }

    const dedupeKey = makeEmailDedupeKey([
      "inactivity_warning",
      target.playerId,
      target.lastMatchDate ?? "never",
    ]);
    const reserved = await reserveEmailEvent({
      type: "inactivity_warning",
      dedupeKey,
      recipientEmail: email,
      playerId: target.playerId,
      entityType: "player",
      entityId: target.playerId,
    });

    if (!reserved) {
      skipped += 1;
      continue;
    }

    try {
      const message = buildInactivityWarningEmail(target);

      await sendTransactionalEmail({
        to: email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      await markEmailEventSent(dedupeKey);
      sent += 1;
    } catch (error) {
      await markEmailEventFailed(dedupeKey, error);
      failed += 1;
      console.error("Failed to send inactivity warning email", error);
    }
  }

  return {
    sent,
    skipped,
    failed,
    totalTargets: testTargets.length,
    suppressedTargets: targets.length - testTargets.length,
  };
}
