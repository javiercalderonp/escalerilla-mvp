import { and, asc, eq, inArray } from "drizzle-orm";

import { getTodayInSantiago } from "@/lib/date";
import { db } from "@/lib/db";
import { availability, players, users, weeks } from "@/lib/db/schema";
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
  uniqueRecipients,
  wait,
} from "@/lib/email/shared";
import { env } from "@/lib/env";
import {
  formatDelta,
  getRanking,
  type RankingCategory,
  type RankingEntry,
  rankingCategoryFromGender,
  rankingCategoryLabels,
} from "@/lib/ranking";

type ReminderTarget = {
  id: string;
  fullName: string;
  firstName: string | null;
  email: string;
  gender: "M" | "F";
};

type RankingSnippet = {
  category: RankingCategory;
  entries: RankingEntry[];
};

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getNextMonday(today: string) {
  const date = parseDate(today);
  const day = date.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;

  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return date.toISOString().slice(0, 10);
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function getRankingSnippet(
  ranking: RankingEntry[],
  playerId: string,
): RankingEntry[] {
  const playerIndex = ranking.findIndex((entry) => entry.id === playerId);

  if (playerIndex === -1) {
    return ranking.slice(0, 11);
  }

  const desiredCount = 11;
  const before = 5;
  let start = Math.max(0, playerIndex - before);
  let end = Math.min(ranking.length, start + desiredCount);

  if (end - start < desiredCount) {
    start = Math.max(0, end - desiredCount);
    end = Math.min(ranking.length, start + desiredCount);
  }

  return ranking.slice(start, end);
}

function getPositionColor(position: number) {
  if (position === 1) return "#c98a10";
  if (position === 2) return "#7c8794";
  if (position === 3) return "#b36b2c";
  return "#5b6675";
}

function getRowBorderColor(position: number, isCurrentPlayer: boolean) {
  if (isCurrentPlayer) return "#e8720c";
  if (position === 1) return "#c98a10";
  if (position === 2) return "#7c8794";
  if (position === 3) return "#b36b2c";
  return "transparent";
}

function buildRankingRowsHtml(entries: RankingEntry[], playerId: string) {
  return entries
    .map((entry) => {
      const isCurrentPlayer = entry.id === playerId;
      const rowBg = isCurrentPlayer
        ? "#fff7ed"
        : entry.position <= 3
          ? "#f8fafc"
          : "#ffffff";
      const deltaColor =
        entry.weeklyDelta > 0
          ? "#247a45"
          : entry.weeklyDelta < 0
            ? "#b42318"
            : "#7c8794";

      return `
        <tr>
          <td style="padding:11px 10px;border-top:1px solid #e1e7ef;border-left:4px solid ${getRowBorderColor(entry.position, isCurrentPlayer)};background:${rowBg};font-size:13px;font-weight:900;color:${getPositionColor(entry.position)};text-align:center;">${entry.position}</td>
          <td style="padding:11px 10px;border-top:1px solid #e1e7ef;background:${rowBg};font-size:13px;font-weight:${isCurrentPlayer ? "900" : "700"};color:#07182a;line-height:1.3;">${escapeHtml(entry.fullName)}</td>
          <td style="padding:11px 8px;border-top:1px solid #e1e7ef;background:${rowBg};font-size:13px;font-weight:900;color:#07182a;text-align:right;">${entry.points}</td>
          <td style="padding:11px 6px;border-top:1px solid #e1e7ef;background:${rowBg};font-size:13px;color:#5b6675;text-align:center;">${entry.matchesPlayed}</td>
          <td style="padding:11px 6px;border-top:1px solid #e1e7ef;background:${rowBg};font-size:13px;font-weight:800;color:#247a45;text-align:center;">${entry.matchesWon}</td>
          <td style="padding:11px 6px;border-top:1px solid #e1e7ef;background:${rowBg};font-size:13px;font-weight:800;color:#b42318;text-align:center;">${entry.matchesLost}</td>
          <td style="padding:11px 10px;border-top:1px solid #e1e7ef;background:${rowBg};font-size:13px;font-weight:800;color:${deltaColor};text-align:right;">${escapeHtml(formatDelta(entry.weeklyDelta))}</td>
        </tr>`;
    })
    .join("");
}

function buildRankingBlockHtml(args: {
  playerId: string;
  rankingSnippet: RankingSnippet | null;
  rankingUrl: string;
}) {
  if (!args.rankingSnippet || args.rankingSnippet.entries.length === 0) {
    return "";
  }

  const categoryLabel = rankingCategoryLabels[args.rankingSnippet.category];
  const rowsHtml = buildRankingRowsHtml(
    args.rankingSnippet.entries,
    args.playerId,
  );

  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e1e7ef;border-radius:8px;margin:0 0 18px;background:#ffffff;">
  <tr>
    <td style="padding:22px 24px 14px;text-align:left;">
      <p style="margin:0 0 5px;font-size:14px;font-weight:900;color:#07182a;text-transform:uppercase;letter-spacing:0.04em;">Tu zona del ranking ${escapeHtml(categoryLabel)}</p>
      <p style="margin:0;font-size:13px;color:#5b6675;line-height:1.45;">Mostramos tu posición y hasta 10 lugares cercanos, como referencia para la próxima semana.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 18px 18px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e1e7ef;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:9px 10px;background:#f5f7fb;font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;letter-spacing:0.06em;text-align:center;">#</td>
          <td style="padding:9px 10px;background:#f5f7fb;font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;letter-spacing:0.06em;">Jugador</td>
          <td style="padding:9px 8px;background:#f5f7fb;font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Pts</td>
          <td style="padding:9px 6px;background:#f5f7fb;font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;letter-spacing:0.06em;text-align:center;">PJ</td>
          <td style="padding:9px 6px;background:#f5f7fb;font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;letter-spacing:0.06em;text-align:center;">PG</td>
          <td style="padding:9px 6px;background:#f5f7fb;font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;letter-spacing:0.06em;text-align:center;">PP</td>
          <td style="padding:9px 10px;background:#f5f7fb;font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Δ</td>
        </tr>
        ${rowsHtml}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 24px 22px;text-align:center;">
      <a href="${escapeHtml(args.rankingUrl)}" style="display:inline-block;background:#07182a;color:#ffffff;text-decoration:none;border-radius:7px;padding:13px 22px;font-size:14px;font-weight:900;line-height:1;text-align:center;">Ver ranking completo</a>
    </td>
  </tr>
</table>`;
}

function buildRankingTextLines(snippet: RankingSnippet | null) {
  if (!snippet || snippet.entries.length === 0) {
    return [];
  }

  return [
    "",
    `Ranking ${rankingCategoryLabels[snippet.category]} cercano:`,
    ...snippet.entries.map(
      (entry) =>
        `${entry.position}. ${entry.fullName} - ${entry.points} pts - PJ ${entry.matchesPlayed} PG ${entry.matchesWon} PP ${entry.matchesLost} - ${formatDelta(entry.weeklyDelta)}`,
    ),
  ];
}

export function buildAvailabilityReminderEmail(args: {
  playerId?: string;
  playerName: string;
  playerFirstName?: string | null;
  weekStartsOn: string;
  weekEndsOn: string;
  deadline: string;
  rankingSnippet?: RankingSnippet | null;
}) {
  const availabilityUrl = absoluteUrl("/disponibilidad");
  const rankingUrl = absoluteUrl(
    args.rankingSnippet
      ? `/ranking/${args.rankingSnippet.category}`
      : "/ranking",
  );
  const title = "Confirma tu disponibilidad para la próxima semana";
  const firstName = args.playerFirstName || getFirstName(args.playerName);
  const formattedWeek = `${formatDate(args.weekStartsOn)} al ${formatDate(
    args.weekEndsOn,
  )}`;
  const formattedDeadline = formatDate(args.deadline);
  const textLines = [
    `Hola ${firstName},`,
    "",
    "Aún no has confirmado si puedes jugar la próxima semana.",
    `Semana: ${formattedWeek}.`,
    `Por favor márcalo antes del ${formattedDeadline} a las 23:59 hrs.`,
    "",
    "Tu confirmación ayuda a armar mejores partidos, equilibrar el sorteo y evitar quedar fuera por falta de respuesta.",
    "",
    `Confirmar disponibilidad: ${availabilityUrl}`,
    `Ajustar horarios disponibles: ${availabilityUrl}`,
    `Ver ranking: ${rankingUrl}`,
    ...buildRankingTextLines(args.rankingSnippet ?? null),
  ];
  const rankingBlockHtml = buildRankingBlockHtml({
    playerId: args.playerId ?? "",
    rankingSnippet: args.rankingSnippet ?? null,
    rankingUrl,
  });
  const innerHtml = `
<div class="em-email-heading" style="text-align:center;margin:0 0 30px;">
  <p class="em-email-kicker" style="margin:0 0 14px;font-size:12px;font-weight:900;color:#e8720c;letter-spacing:0.08em;text-transform:uppercase;">&#128197; Disponibilidad pendiente</p>
  <h1 class="em-email-title-large" style="margin:0 auto;max-width:480px;font-size:32px;font-weight:900;color:#07182a;line-height:1.16;">Confirma tu disponibilidad<br>para la <span style="color:#e8720c;">próxima semana</span></h1>
  <p class="em-email-intro" style="margin:18px auto 0;max-width:480px;font-size:15px;color:#314156;line-height:1.55;">Tu disponibilidad es clave para que podamos realizar el sorteo y programar los partidos de la semana.</p>
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e1e7ef;border-radius:8px;margin:0 0 18px;background:#ffffff;">
  <tr>
    <td class="em-email-panel-pad" style="padding:22px 24px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td valign="middle" style="padding:0;text-align:left;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:#07182a;line-height:1.25;">Hola ${escapeHtml(firstName)},</p>
            <p style="margin:0;font-size:15px;color:#314156;line-height:1.5;">Aún no confirmaste si podrás jugar la próxima semana.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td class="em-email-panel-pad" style="padding:14px 24px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e1e7ef;border-radius:8px;">
        <tr>
          <td width="50%" valign="middle" class="em-col-half" style="padding:18px 18px;border-right:1px solid #e1e7ef;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td width="54" style="width:54px;padding-right:14px;">
                  <div style="width:44px;height:44px;border-radius:50%;background:#07185a;color:#ffffff;font-size:22px;line-height:44px;text-align:center;">&#128197;</div>
                </td>
                <td>
                  <p style="margin:0 0 5px;font-size:11px;font-weight:900;color:#07182a;text-transform:uppercase;letter-spacing:0.06em;">Semana</p>
                  <p style="margin:0;font-size:15px;font-weight:900;color:#07182a;line-height:1.35;">${escapeHtml(formattedWeek)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td width="50%" valign="middle" class="em-col-half" style="padding:18px 18px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td width="54" style="width:54px;padding-right:14px;">
                  <div style="width:44px;height:44px;border-radius:50%;background:#07185a;color:#ffffff;font-size:22px;line-height:44px;text-align:center;">&#9200;</div>
                </td>
                <td>
                  <p style="margin:0 0 5px;font-size:11px;font-weight:900;color:#07182a;text-transform:uppercase;letter-spacing:0.06em;">Plazo límite</p>
                  <p style="margin:0 0 4px;font-size:17px;font-weight:900;color:#e8720c;line-height:1;">${escapeHtml(formattedDeadline)}</p>
                  <p style="margin:0;font-size:13px;color:#314156;">23:59 hrs</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e1e7ef;border-radius:8px;margin:0 0 18px;background:#ffffff;">
  <tr>
    <td class="em-email-panel-pad" style="padding:22px 24px 12px;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:900;color:#07182a;text-transform:uppercase;letter-spacing:0.04em;">¿Por qué es importante?</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 18px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td width="33.33%" valign="top" class="em-col-third" style="padding:0 14px;text-align:center;border-right:1px solid #e1e7ef;">
            <div style="width:46px;height:46px;border-radius:50%;background:#dce9ff;color:#0b5ed7;font-size:22px;line-height:46px;text-align:center;margin:0 auto 12px;">&#127941;</div>
            <p style="margin:0 0 8px;font-size:14px;font-weight:900;color:#07182a;">Mejores partidos</p>
            <p style="margin:0;font-size:13px;color:#314156;line-height:1.45;">El sorteo se basa en la disponibilidad de todos los jugadores.</p>
          </td>
          <td width="33.33%" valign="top" class="em-col-third" style="padding:0 14px;text-align:center;border-right:1px solid #e1e7ef;">
            <div style="width:46px;height:46px;border-radius:50%;background:#dce9ff;color:#0b5ed7;font-size:22px;line-height:46px;text-align:center;margin:0 auto 12px;">&#9878;</div>
            <p style="margin:0 0 8px;font-size:14px;font-weight:900;color:#07182a;">Competencia justa</p>
            <p style="margin:0;font-size:13px;color:#314156;line-height:1.45;">Permite organizar cruces equilibrados y buenos horarios.</p>
          </td>
          <td width="33.33%" valign="top" class="em-col-third" style="padding:0 14px;text-align:center;">
            <div style="width:46px;height:46px;border-radius:50%;background:#dce9ff;color:#0b5ed7;font-size:22px;line-height:46px;text-align:center;margin:0 auto 12px;">&#9989;</div>
            <p style="margin:0 0 8px;font-size:14px;font-weight:900;color:#07182a;">Evita quedar fuera</p>
            <p style="margin:0;font-size:13px;color:#314156;line-height:1.45;">Sin confirmación no podremos considerarte en el sorteo.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 30px 24px;text-align:center;">
      <a href="${escapeHtml(availabilityUrl)}" class="em-email-action-large" style="display:block;background:#e8720c;color:#ffffff;text-decoration:none;border-radius:7px;padding:18px 24px;font-size:20px;font-weight:900;line-height:1;text-align:center;">&#10003; Confirmar disponibilidad</a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 30px 24px;text-align:center;">
      <a href="${escapeHtml(availabilityUrl)}" class="em-email-action" style="display:block;background:#07182a;color:#ffffff;text-decoration:none;border-radius:7px;padding:16px 22px;font-size:16px;font-weight:900;line-height:1;text-align:center;">&#128336; Ajustar mis horarios disponibles</a>
      <p style="margin:12px 0 0;font-size:13px;color:#314156;line-height:1.45;">Puedes editar los bloques horarios en que normalmente puedes jugar.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 30px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #e1e7ef;">
        <tr>
          <td width="62" valign="middle" style="padding:18px 16px 0 0;">
            <div style="width:46px;height:46px;border-radius:50%;background:#fff0c2;color:#e8720c;font-size:24px;line-height:46px;text-align:center;">&#128276;</div>
          </td>
          <td valign="middle" style="padding:18px 12px 0 0;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:900;color:#07182a;">Recuerda confirmar antes del ${escapeHtml(formattedDeadline)}</p>
            <p style="margin:0;font-size:13px;color:#314156;line-height:1.4;">Después de esa fecha no podrás participar del sorteo.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

${rankingBlockHtml}

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#07182a;border-radius:8px;margin:0;">
  <tr>
    <td width="62" valign="middle" style="padding:20px 0 20px 24px;">
      <div style="width:48px;height:48px;border-radius:50%;background:#063b79;color:#3b82f6;font-size:24px;line-height:48px;text-align:center;">&#128200;</div>
    </td>
    <td valign="middle" style="padding:20px 16px;">
      <p style="margin:0 0 5px;font-size:15px;font-weight:900;color:#ffffff;">Cada confirmación hace la diferencia</p>
      <p style="margin:0;font-size:13px;color:#d6e3f3;line-height:1.4;">Cuantos más jugadores confirman, mejores partidos para todos.</p>
    </td>
    <td align="right" valign="middle" width="150" class="em-mobile-cta" style="width:150px;padding:20px 24px 20px 0;">
      <a href="${escapeHtml(rankingUrl)}" style="display:inline-block;background:#ffffff;color:#0b5ed7;text-decoration:none;border-radius:7px;padding:13px 22px;font-size:14px;font-weight:900;line-height:1;text-align:center;white-space:nowrap;">Ver ranking</a>
    </td>
  </tr>
</table>
`;

  return {
    subject: title,
    text: textLines.join("\n"),
    html: buildEmailLayout(title, innerHtml),
  };
}

async function loadReminderTargets() {
  const dbClient = db;

  if (!dbClient) {
    return null;
  }

  const today = getTodayInSantiago();
  const fallbackStartsOn = getNextMonday(today);
  const fallbackEndsOn = addDays(fallbackStartsOn, 6);
  const fallbackDeadline = addDays(fallbackStartsOn, -3);

  const [targetWeek] = await dbClient
    .select({
      id: weeks.id,
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
    })
    .from(weeks)
    .where(eq(weeks.startsOn, fallbackStartsOn))
    .orderBy(asc(weeks.startsOn))
    .limit(1);

  const activePlayers = await dbClient
    .select({
      id: players.id,
      fullName: players.fullName,
      firstName: players.firstName,
      email: players.email,
      gender: players.gender,
      wantsToPlayNextWeek: players.wantsToPlayNextWeek,
    })
    .from(players)
    .innerJoin(users, eq(users.playerId, players.id))
    .where(
      and(
        eq(players.status, "activo"),
        inArray(users.role, ["admin", "player"]),
      ),
    );

  const playersWithWeekAvailability = targetWeek
    ? await dbClient
        .select({ playerId: availability.playerId })
        .from(availability)
        .where(eq(availability.weekId, targetWeek.id))
    : [];
  const availablePlayerIds = new Set(
    playersWithWeekAvailability.map((row) => row.playerId),
  );

  const targets = uniqueRecipients(
    activePlayers
      .filter(
        (player) =>
          !player.wantsToPlayNextWeek && !availablePlayerIds.has(player.id),
      )
      .map((player) => ({
        email: player.email ?? "",
        kind: "player" as const,
        playerId: player.id,
        name: player.fullName,
        firstName: player.firstName,
        gender: player.gender,
      })),
  ).map(
    (recipient): ReminderTarget => ({
      id: recipient.playerId ?? "",
      fullName: recipient.name ?? "",
      firstName: recipient.firstName,
      email: recipient.email,
      gender: recipient.gender,
    }),
  );

  return {
    targets: targets.filter((target) => target.id),
    weekId: targetWeek?.id ?? null,
    weekStartsOn: targetWeek?.startsOn ?? fallbackStartsOn,
    weekEndsOn: targetWeek?.endsOn ?? fallbackEndsOn,
    deadline: targetWeek?.startsOn
      ? addDays(targetWeek.startsOn, -3)
      : fallbackDeadline,
  };
}

export async function sendAvailabilityReminders() {
  if (!env.emailsEnabled) {
    return { sent: 0, skipped: 0, failed: 0, reason: "emails_disabled" };
  }

  if (!env.resendApiKey || !env.emailFrom) {
    console.warn(
      "Email notifications are enabled but RESEND_API_KEY or EMAIL_FROM is missing.",
    );
    return { sent: 0, skipped: 0, failed: 0, reason: "email_env_missing" };
  }

  const data = await loadReminderTargets();

  if (!data) {
    return { sent: 0, skipped: 0, failed: 0, reason: "db_not_configured" };
  }

  const targets = env.emailTestRecipient
    ? data.targets.slice(0, 1)
    : data.targets;
  const [hombresRanking, mujeresRanking] = await Promise.all([
    getRanking("hombres"),
    getRanking("mujeres"),
  ]);
  const rankingsByCategory: Record<RankingCategory, RankingEntry[]> = {
    hombres: hombresRanking,
    mujeres: mujeresRanking,
  };
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    await wait(250);
    const dedupeKey = makeEmailDedupeKey([
      "availability_reminder",
      env.emailTestRecipient ? `test:${env.emailTestRecipient}` : null,
      data.weekStartsOn,
      target.id,
    ]);
    const reserved = await reserveEmailEvent({
      type: "availability_reminder",
      dedupeKey,
      recipientEmail: target.email,
      playerId: target.id,
      entityType: data.weekId ? "week" : "week_start",
      entityId: data.weekId,
    });

    if (!reserved) {
      skipped += 1;
      continue;
    }

    try {
      const category = rankingCategoryFromGender(target.gender);
      const rankingSnippet = {
        category,
        entries: getRankingSnippet(rankingsByCategory[category], target.id),
      };
      const message = buildAvailabilityReminderEmail({
        playerId: target.id,
        playerName: target.fullName,
        playerFirstName: target.firstName,
        weekStartsOn: data.weekStartsOn,
        weekEndsOn: data.weekEndsOn,
        deadline: data.deadline,
        rankingSnippet,
      });

      await sendTransactionalEmail({
        to: target.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      await markEmailEventSent(dedupeKey);
      sent += 1;
    } catch (error) {
      await markEmailEventFailed(dedupeKey, error);
      failed += 1;
      console.error("Failed to send availability reminder email", error);
    }
  }

  return {
    sent,
    skipped,
    failed,
    totalTargets: targets.length,
    suppressedTargets: data.targets.length - targets.length,
    weekStartsOn: data.weekStartsOn,
    weekEndsOn: data.weekEndsOn,
    deadline: data.deadline,
  };
}
