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
  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>Hola ${escapeHtml(target.fullName)},</p>`,
    `<p>Llevas ${target.daysSince} días sin jugar.</p>`,
    "<p>Si no juegas pronto, perderás 40 puntos por inactividad.</p>",
    "<p>¡Agenda tu partido esta semana!</p>",
    `<p><a href="${escapeHtml(fixtureUrl)}">Ver partidos</a></p>`,
  ].join("\n");

  return {
    subject: title,
    text: textLines.join("\n"),
    html,
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

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async (target) => {
      const email = target.email?.trim().toLowerCase();

      if (!email) {
        skipped += 1;
        return;
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
        return;
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
    }),
  );

  return { sent, skipped, failed, totalTargets: targets.length };
}
