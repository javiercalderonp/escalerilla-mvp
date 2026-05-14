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

function buildMessage(target: InactivityWarningTarget) {
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
<h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#0d1b2a;line-height:1.3;">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;color:#0d1b2a;line-height:1.6;">Hola <strong>${escapeHtml(target.fullName)}</strong>,</p>
<div style="background-color:#f6f2ea;border-radius:8px;border:1px solid #ded6ca;padding:20px 24px;margin:0 0 24px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Días sin jugar</p>
  <p style="margin:0;font-size:28px;font-weight:800;color:#0d1b2a;">${target.daysSince}</p>
</div>
<p style="margin:0 0 16px;font-size:15px;color:#0d1b2a;line-height:1.6;">Si no jugás pronto, perderás <strong>40 puntos</strong> por inactividad.</p>
<p style="margin:0 0 28px;font-size:15px;color:#0d1b2a;line-height:1.6;">¡Agendá tu partido esta semana!</p>
<a href="${escapeHtml(fixtureUrl)}" style="display:inline-block;padding:13px 28px;background-color:#0d1b2a;color:#fffdfa;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;line-height:1;">Ver partidos</a>`;

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
      const message = buildMessage(target);

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
