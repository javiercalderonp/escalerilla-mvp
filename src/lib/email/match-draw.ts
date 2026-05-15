import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import {
  AVAILABILITY_DAYS,
  type AvailabilitySlots,
  buildAvailabilitySlots,
  getSharedAvailabilityRanges,
  MIN_MATCH_OVERLAP_SLOTS,
  SLOT_COUNT,
  SLOT_MINUTES,
  summarizeAvailabilityDay,
} from "@/lib/availability";
import { getTodayInSantiago } from "@/lib/date";
import { db } from "@/lib/db";
import { matches, matchSets, players, weeks } from "@/lib/db/schema";
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
import { getRanking } from "@/lib/ranking";

export type DrawPlayer = {
  id: string;
  fullName: string;
  email: string | null;
  gender: "M" | "F";
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

export type DrawMatch = {
  id: string;
  player1Id: string;
  player2Id: string;
  category: "M" | "F";
};

type PlayerEmailStats = {
  position: number;
  points: number;
  weeklyDelta: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  recentForm: Array<"W" | "L" | "D">;
};

type HeadToHeadStats = {
  playerWins: number;
  opponentWins: number;
  draws: number;
};

type RecentMatchSummary = {
  id: string;
  playedOn: string | null;
  status: "confirmado" | "wo" | "empate";
  winnerId: string | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  sets: Array<{
    setNumber: number;
    gamesP1: number;
    gamesP2: number;
    tiebreakP1: number | null;
    tiebreakP2: number | null;
  }>;
};

type RecommendedTimeOption = {
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
};

type OtherWeekMatch = {
  id: string;
  player1Name: string;
  player2Name: string;
  player1Ranking: number | null;
  player2Ranking: number | null;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    timeZone: "America/Santiago",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return "0";
}

function formatForm(form: Array<"W" | "L" | "D">) {
  if (form.length === 0) return "Sin partidos recientes";

  return form
    .map((result) => {
      if (result === "W") return "G";
      if (result === "L") return "P";
      return "E";
    })
    .join(" ");
}

function formatFormHtml(form: Array<"W" | "L" | "D">) {
  if (form.length === 0) {
    return `<span style="font-size:12px;color:#776f66;">Sin partidos recientes</span>`;
  }

  return form
    .map((result) => {
      const label = result === "W" ? "W" : result === "L" ? "L" : "E";
      const color =
        result === "W" ? "#5fbd3f" : result === "L" ? "#f04452" : "#9aa3af";

      return `<span class="em-form-dot" style="display:inline-block;width:18px;height:18px;margin:0 3px;border-radius:50%;background-color:${color};color:#ffffff;font-size:10px;font-weight:800;line-height:18px;text-align:center;">${label}</span>`;
    })
    .join("");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatFirstName(name: string) {
  return name.split(" ").filter(Boolean)[0] ?? name;
}

function formatPlayerNameHtml(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return escapeHtml(name);

  return `${escapeHtml(parts[0])}<br>${escapeHtml(parts.slice(1).join(" "))}`;
}

function formatRanking(stats: PlayerEmailStats | undefined) {
  if (!stats) return "Ranking no disponible";

  return `#${stats.position} · ${stats.points} pts · semana ${formatDelta(
    stats.weeklyDelta,
  )} · ${stats.matchesWon}G-${stats.matchesLost}P`;
}

function formatRankingPosition(stats: PlayerEmailStats | undefined) {
  return stats ? `#${stats.position}` : "S/R";
}

function formatDrawPlayerSummaryHtml(
  player: DrawPlayer,
  stats: PlayerEmailStats | undefined,
) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td width="84" valign="middle" class="em-player-avatar-cell" style="width:84px;padding:0 16px 0 0;">
        <div class="em-player-avatar" style="width:76px;height:76px;border-radius:50%;background-color:#d8e1ea;color:#0d1b2a;font-size:26px;font-weight:900;line-height:76px;text-align:center;">${escapeHtml(getInitials(player.fullName))}</div>
      </td>
      <td valign="middle" class="em-player-info" style="padding:0;text-align:left;">
        <p class="em-player-name" style="margin:0 0 10px;font-size:20px;font-weight:900;color:#0d1b2a;line-height:1.18;">${formatPlayerNameHtml(player.fullName)}</p>
        <p class="em-ranking-label" style="margin:0 0 2px;font-size:14px;color:#697386;line-height:1.2;">Ranking actual</p>
        <p class="em-ranking-value" style="margin:0;font-size:25px;font-weight:900;color:#0d1b2a;line-height:1;">${escapeHtml(formatRankingPosition(stats))}</p>
      </td>
    </tr>
  </table>`;
}

function formatHeadToHead(stats: HeadToHeadStats | undefined) {
  if (!stats) return "0 - 0";
  return `${stats.playerWins} - ${stats.opponentWins}`;
}

function formatHeadToHeadLeader(stats: HeadToHeadStats | undefined) {
  if (!stats || stats.playerWins + stats.opponentWins + stats.draws === 0) {
    return "Sin historial";
  }
  if (stats.playerWins === stats.opponentWins) return "Historial parejo";
  return stats.playerWins > stats.opponentWins
    ? "Lideras tú"
    : "Lidera tu rival";
}

function formatSetScore(set: RecentMatchSummary["sets"][number]) {
  const base = `${set.gamesP1}-${set.gamesP2}`;
  if (set.tiebreakP1 == null || set.tiebreakP2 == null) return base;

  return `${base} (${set.tiebreakP1}-${set.tiebreakP2})`;
}

function formatMatchScore(match: RecentMatchSummary) {
  if (match.status === "wo") return "W.O.";
  if (match.status === "empate") return "Empate";
  if (match.sets.length === 0) return "Resultado confirmado";

  return match.sets.map(formatSetScore).join(", ");
}

function getMatchResult(match: RecentMatchSummary, playerId: string) {
  if (match.status === "empate" || !match.winnerId) return "empató";
  return match.winnerId === playerId ? "ganó" : "perdió";
}

function getOpponentName(match: RecentMatchSummary, playerId: string) {
  return match.player1Id === playerId ? match.player2Name : match.player1Name;
}

function formatRecentMatch(match: RecentMatchSummary, playerId: string) {
  const date = match.playedOn ? formatDate(match.playedOn) : "Sin fecha";
  return `${date}: ${getMatchResult(match, playerId)} vs ${getOpponentName(
    match,
    playerId,
  )} · ${formatMatchScore(match)}`;
}

function formatRecentMatches(
  matchesToFormat: RecentMatchSummary[] | undefined,
  playerId: string,
) {
  if (!matchesToFormat?.length) {
    return ["Sin partidos registrados recientemente."];
  }

  return matchesToFormat
    .slice(0, 3)
    .map((match) => formatRecentMatch(match, playerId));
}

function makeAllAvailabilitySlots(): AvailabilitySlots {
  return AVAILABILITY_DAYS.reduce((acc, { key }) => {
    acc[key] = Array.from({ length: SLOT_COUNT }, () => true);
    return acc;
  }, {} as AvailabilitySlots);
}

function getEmailAvailabilitySlots(player: DrawPlayer) {
  return player.alwaysAvailable
    ? makeAllAvailabilitySlots()
    : buildAvailabilitySlots(player);
}

const dayOffsets = new Map(
  AVAILABILITY_DAYS.map(({ key }, index) => [key, index] as const),
);

function getRecommendedTimeOptions(
  player: DrawPlayer,
  opponent: DrawPlayer,
  weekStartsOn: string,
) {
  const sharedRanges = getSharedAvailabilityRanges(
    getEmailAvailabilitySlots(player),
    getEmailAvailabilitySlots(opponent),
    MIN_MATCH_OVERLAP_SLOTS,
  );

  return sharedRanges.map((range) => {
    const dayDate = addDays(weekStartsOn, dayOffsets.get(range.dayKey) ?? 0);

    return {
      dayLabel: range.dayLabel,
      dateLabel: formatLongDate(dayDate),
      timeLabel: range.label.replace(`${range.dayLabel} `, ""),
      durationLabel: formatDurationLabel(
        (range.end - range.start) * SLOT_MINUTES,
      ),
    };
  });
}

function formatDurationLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}min`;
}

function formatRecommendedTimes(times: RecommendedTimeOption[]) {
  return times.length > 0
    ? times.map(
        (time) =>
          `${time.dayLabel} ${time.dateLabel}: ${time.timeLabel} (${time.durationLabel})`,
      )
    : ["No hay cruces claros de disponibilidad; coordinen directo."];
}

function formatListText(title: string, lines: string[]) {
  return [title, ...lines.map((line) => `- ${line}`)].join("\n");
}

function formatListHtml(lines: string[], color = "#0d1b2a") {
  return lines
    .map(
      (line) =>
        `<li style="padding:8px 0;font-size:14px;color:${color};line-height:1.5;border-bottom:1px solid #f0ede8;">${escapeHtml(line)}</li>`,
    )
    .join("\n");
}

function formatRecommendedCardsHtml(times: RecommendedTimeOption[]) {
  if (times.length === 0) {
    return `<tr>
      <td style="padding:0 0 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e4e8ef;border-radius:8px;background-color:#ffffff;">
          <tr>
            <td style="padding:14px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#0d1b2a;line-height:1.4;">No hay cruces claros</p>
              <p style="margin:6px 0 0;font-size:12px;color:#697386;line-height:1.4;">Coordinen directo según sus disponibilidades.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }

  return times
    .map((time) => {
      return `<tr>
        <td style="padding:0 0 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e4e8ef;border-radius:8px;background-color:#ffffff;">
            <tr>
              <td width="34%" valign="middle" class="em-time-block" style="padding:13px 14px;border-right:1px solid #edf0f5;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:900;color:#697386;text-transform:uppercase;line-height:1.2;">Fecha</p>
                <p style="margin:0;font-size:13px;font-weight:800;color:#0d1b2a;line-height:1.35;">${escapeHtml(time.dayLabel)} ${escapeHtml(time.dateLabel)}</p>
              </td>
              <td width="33%" valign="middle" align="center" class="em-time-block" style="padding:13px 10px;border-right:1px solid #edf0f5;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:900;color:#697386;text-transform:uppercase;line-height:1.2;">Horario</p>
                <p style="margin:0;font-size:18px;font-weight:900;color:#0d1b2a;line-height:1.2;">${escapeHtml(time.timeLabel)}</p>
              </td>
              <td width="33%" valign="middle" align="center" class="em-time-block em-time-block-last" style="padding:13px 10px;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:900;color:#697386;text-transform:uppercase;line-height:1.2;">Coincidencia</p>
                <p style="margin:0 0 3px;font-size:14px;font-weight:900;color:#2f9e44;line-height:1.2;">Ambos disponibles</p>
                <p style="margin:0;font-size:11px;color:#405066;line-height:1.2;">${escapeHtml(time.durationLabel)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");
}

function formatOtherMatchesHtml(matchesToFormat: OtherWeekMatch[]) {
  if (matchesToFormat.length === 0) {
    return `<p style="margin:0;font-size:13px;color:#697386;line-height:1.5;">No hay otros partidos publicados en esta semana.</p>`;
  }

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #edf0f5;border-radius:8px;background-color:#ffffff;">
    ${matchesToFormat
      .slice(0, 4)
      .map(
        (match) => `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #edf0f5;font-size:13px;color:#0d1b2a;line-height:1.3;">${escapeHtml(match.player1Name)}${match.player1Ranking ? ` (${match.player1Ranking}°)` : ""}</td>
          <td align="center" style="padding:10px 6px;border-bottom:1px solid #edf0f5;font-size:10px;font-weight:900;color:#697386;line-height:1.3;">VS</td>
          <td style="padding:10px 12px;border-bottom:1px solid #edf0f5;font-size:13px;color:#0d1b2a;line-height:1.3;">${escapeHtml(match.player2Name)}${match.player2Ranking ? ` (${match.player2Ranking}°)` : ""}</td>
        </tr>`,
      )
      .join("")}
  </table>`;
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
    .map(
      (line) =>
        `<li style="padding:8px 0;font-size:14px;color:#0d1b2a;line-height:1.5;border-bottom:1px solid #f0ede8;">${escapeHtml(line)}</li>`,
    )
    .join("\n");
}

export function buildMatchDrawEmail(args: {
  player: DrawPlayer;
  opponent: DrawPlayer;
  match: DrawMatch;
  weekStartsOn: string;
  weekEndsOn: string;
  playerStats?: PlayerEmailStats;
  opponentStats?: PlayerEmailStats;
  headToHeadStats?: HeadToHeadStats;
  opponentRecentMatches?: RecentMatchSummary[];
  otherMatches?: OtherWeekMatch[];
  recommendedTimes?: RecommendedTimeOption[];
}) {
  const fixtureUrl = absoluteUrl("/fixture");
  const rankingUrl = absoluteUrl(
    `/ranking/${args.player.gender === "M" ? "hombres" : "mujeres"}`,
  );
  const title = "Tienes partido esta semana";
  const opponentAvailability = formatAvailability(args.opponent);
  const playerAvailability = formatAvailability(args.player);
  const recommendedTimeOptions =
    args.recommendedTimes ??
    getRecommendedTimeOptions(args.player, args.opponent, args.weekStartsOn);
  const recommendedTimeLines = formatRecommendedTimes(recommendedTimeOptions);
  const otherMatches = args.otherMatches ?? [];
  const firstName = formatFirstName(args.player.fullName);
  const textRecommendedTimes = formatListText(
    "Horarios recomendados:",
    recommendedTimeLines,
  );
  const opponentRecentMatches = formatRecentMatches(
    args.opponentRecentMatches,
    args.opponent.id,
  );
  const textLines = [
    `Hola ${args.player.fullName},`,
    "",
    `Tienes partido contra ${args.opponent.fullName}.`,
    `Semana: ${formatDate(args.weekStartsOn)} al ${formatDate(args.weekEndsOn)}.`,
    "",
    "Ranking:",
    `${args.player.fullName}: ${formatRanking(args.playerStats)}`,
    `${args.opponent.fullName}: ${formatRanking(args.opponentStats)}`,
    "",
    `Forma reciente de ${args.player.fullName}: ${formatForm(
      args.playerStats?.recentForm ?? [],
    )}`,
    `Forma reciente de ${args.opponent.fullName}: ${formatForm(
      args.opponentStats?.recentForm ?? [],
    )}`,
    `Historial entre ambos: ${formatHeadToHead(args.headToHeadStats)} (${formatHeadToHeadLeader(args.headToHeadStats)})`,
    "",
    formatListText("Últimos partidos del rival:", opponentRecentMatches),
    "",
    textRecommendedTimes,
    "",
    `Horarios disponibles de ${args.opponent.fullName}:`,
    opponentAvailability,
    "",
    "Tus horarios cargados:",
    playerAvailability,
    "",
    `Ver fixture: ${fixtureUrl}`,
  ];
  const innerHtml = `
<div class="em-draw-heading" style="text-align:center;margin:0 0 24px;">
  <p class="em-draw-kicker" style="margin:0 0 12px;font-size:12px;font-weight:800;color:#e8720c;letter-spacing:0.1em;text-transform:uppercase;">&#10022; SORTEO PUBLICADO</p>
  <h1 class="em-draw-title" style="margin:0;font-size:28px;font-weight:900;color:#0d1b2a;line-height:1.2;">${escapeHtml(title)}</h1>
  <div class="em-draw-rule" style="width:40px;height:3px;background-color:#e8720c;margin:14px auto 0;"></div>
</div>
<p class="em-draw-greeting" style="margin:0 0 4px;font-size:15px;color:#0d1b2a;line-height:1.6;text-align:center;">Hola ${escapeHtml(firstName)},</p>
<p class="em-draw-intro" style="margin:0 0 24px;font-size:14px;color:#405066;line-height:1.6;text-align:center;">Ya salió el sorteo de la semana. Conoce tu próximo desafío.</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="em-match-card" style="border:1px solid #e4e8ef;border-radius:8px;margin:0 0 16px;background-color:#ffffff;">
  <tr>
    <td width="42%" align="center" valign="middle" class="em-match-player" style="padding:20px 16px;">
      ${formatDrawPlayerSummaryHtml(args.player, args.playerStats)}
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="em-form-card" style="background-color:#f8fafc;border-radius:8px;margin-top:16px;">
        <tr>
          <td align="center" class="em-form-card-pad" style="padding:13px 8px;">
            <p class="em-form-title" style="margin:0 0 8px;font-size:10px;font-weight:800;color:#697386;text-transform:uppercase;line-height:1.2;">Últimos partidos</p>
            <p class="em-form-row" style="margin:0 0 8px;line-height:1;">${formatFormHtml(args.playerStats?.recentForm ?? [])}</p>
            <p class="em-form-text" style="margin:0;font-size:11px;color:#405066;line-height:1.3;">Forma: ${escapeHtml(formatForm(args.playerStats?.recentForm ?? []))}</p>
          </td>
        </tr>
      </table>
    </td>
    <td width="16%" align="center" valign="middle" class="em-match-center" style="padding:18px 4px;border-left:1px solid #edf0f5;border-right:1px solid #edf0f5;">
      <div class="em-vs-badge" style="width:44px;height:44px;border:1px solid #d9dee8;border-radius:50%;margin:0 auto 18px;text-align:center;line-height:44px;font-size:15px;font-weight:900;color:#0d1b2a;background-color:#ffffff;">VS</div>
      <p class="em-h2h-label" style="margin:0 0 4px;font-size:11px;font-weight:800;color:#e8720c;line-height:1.2;">Historial</p>
      <p class="em-h2h-score" style="margin:0 0 3px;font-size:22px;font-weight:900;color:#0d1b2a;line-height:1;">${escapeHtml(formatHeadToHead(args.headToHeadStats))}</p>
      <p class="em-h2h-leader" style="margin:0;font-size:11px;color:#697386;line-height:1.2;">${escapeHtml(formatHeadToHeadLeader(args.headToHeadStats))}</p>
    </td>
    <td width="42%" align="center" valign="middle" class="em-match-player" style="padding:20px 16px;">
      ${formatDrawPlayerSummaryHtml(args.opponent, args.opponentStats)}
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="em-form-card" style="background-color:#f8fafc;border-radius:8px;margin-top:16px;">
        <tr>
          <td align="center" class="em-form-card-pad" style="padding:13px 8px;">
            <p class="em-form-title" style="margin:0 0 8px;font-size:10px;font-weight:800;color:#697386;text-transform:uppercase;line-height:1.2;">Últimos partidos</p>
            <p class="em-form-row" style="margin:0 0 8px;line-height:1;">${formatFormHtml(args.opponentStats?.recentForm ?? [])}</p>
            <p class="em-form-text" style="margin:0;font-size:11px;color:#405066;line-height:1.3;">Forma: ${escapeHtml(formatForm(args.opponentStats?.recentForm ?? []))}</p>
          </td>
        </tr>
      </table>
</td>
  </tr>
</table>
<p style="margin:0 0 12px;font-size:13px;font-weight:900;color:#0d1b2a;text-transform:uppercase;letter-spacing:0.02em;">Otros partidos de la semana</p>
${formatOtherMatchesHtml(otherMatches)}
<p style="margin:24px 0 12px;font-size:13px;font-weight:900;color:#0d1b2a;text-transform:uppercase;letter-spacing:0.02em;">Horarios recomendados para tu partido</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 10px;">
  ${formatRecommendedCardsHtml(recommendedTimeOptions)}
</table>
<p style="margin:0 0 20px;font-size:12px;color:#405066;line-height:1.5;">Estos horarios son bloques en que ambos jugadores marcaron disponibilidad y duran al menos 1 hora y media.</p>
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.08em;">Últimos partidos del rival</p>
<ul style="margin:0 0 24px;padding:0;list-style:none;border-top:1px solid #f0ede8;">
  ${formatListHtml(opponentRecentMatches)}
</ul>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
  <tr>
    <td width="50%" valign="top" class="em-col-half" style="padding:0 8px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #f0ede8;border-radius:8px;background-color:#ffffff;">
        <tr>
          <td style="padding:14px 16px 10px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#e8720c;text-transform:uppercase;letter-spacing:0.08em;">Disponibilidad de ${escapeHtml(args.opponent.fullName)}</p>
            <ul style="margin:0;padding:0;list-style:none;border-top:1px solid #f0ede8;">
              ${formatAvailabilityHtml(args.opponent)}
            </ul>
          </td>
        </tr>
      </table>
    </td>
    <td width="50%" valign="top" class="em-col-half" style="padding:0 0 0 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #f0ede8;border-radius:8px;background-color:#ffffff;">
        <tr>
          <td style="padding:14px 16px 10px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.08em;">Tus horarios cargados</p>
            <ul style="margin:0;padding:0;list-style:none;border-top:1px solid #f0ede8;">
              ${formatAvailabilityHtml(args.player)}
            </ul>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 0;">
  <tr>
    <td class="em-full-btn" style="padding:0;">
      <a href="${escapeHtml(fixtureUrl)}" style="display:block;padding:14px 16px;background-color:#e8720c;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;line-height:1;text-align:center;">Ver fixture</a>
    </td>
  </tr>
  <tr>
    <td class="em-full-btn" style="padding:10px 0 0;">
      <a href="${escapeHtml(rankingUrl)}" style="display:block;padding:14px 16px;background-color:#0d1b2a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;line-height:1;text-align:center;">Ver ranking</a>
    </td>
  </tr>
</table>`;

  return {
    subject: `Tienes partido contra ${args.opponent.fullName}`,
    text: textLines.join("\n"),
    html: buildEmailLayout(title, innerHtml),
  };
}

async function sendDrawEmail(args: {
  player: DrawPlayer;
  opponent: DrawPlayer;
  match: DrawMatch;
  weekStartsOn: string;
  weekEndsOn: string;
  playerStats?: PlayerEmailStats;
  opponentStats?: PlayerEmailStats;
  headToHeadStats?: HeadToHeadStats;
  opponentRecentMatches?: RecentMatchSummary[];
  otherMatches?: OtherWeekMatch[];
  recommendedTimes?: RecommendedTimeOption[];
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
    const message = buildMatchDrawEmail(args);

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

function getRecentResult(match: RecentMatchSummary, playerId: string) {
  if (match.status === "empate" || !match.winnerId) return "D" as const;
  return match.winnerId === playerId ? ("W" as const) : ("L" as const);
}

function groupRecentMatchesByPlayer(matchesToGroup: RecentMatchSummary[]) {
  const byPlayer = new Map<string, RecentMatchSummary[]>();

  for (const match of matchesToGroup) {
    for (const playerId of [match.player1Id, match.player2Id]) {
      const current = byPlayer.get(playerId) ?? [];
      current.push(match);
      byPlayer.set(playerId, current);
    }
  }

  return byPlayer;
}

function getPairKey(playerId: string, opponentId: string) {
  return [playerId, opponentId].sort().join(":");
}

async function fetchHeadToHeadByPair(drawMatches: DrawMatch[]) {
  if (!db || drawMatches.length === 0)
    return new Map<string, Map<string, number>>();

  const playerIds = [
    ...new Set(
      drawMatches.flatMap((match) => [match.player1Id, match.player2Id]),
    ),
  ];

  const completedMatches = await db
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      winnerId: matches.winnerId,
      status: matches.status,
    })
    .from(matches)
    .where(
      and(
        or(
          inArray(matches.player1Id, playerIds),
          inArray(matches.player2Id, playerIds),
        ),
        sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
      ),
    );

  const scheduledPairs = new Set(
    drawMatches.map((match) => getPairKey(match.player1Id, match.player2Id)),
  );
  const winsByPair = new Map<string, Map<string, number>>();

  for (const match of completedMatches) {
    const pairKey = getPairKey(match.player1Id, match.player2Id);
    if (!scheduledPairs.has(pairKey)) continue;

    const pairWins = winsByPair.get(pairKey) ?? new Map<string, number>();
    if (match.status === "empate" || !match.winnerId) {
      pairWins.set("draws", (pairWins.get("draws") ?? 0) + 1);
    } else {
      pairWins.set(match.winnerId, (pairWins.get(match.winnerId) ?? 0) + 1);
    }
    winsByPair.set(pairKey, pairWins);
  }

  return winsByPair;
}

function getHeadToHeadStats(
  winsByPair: Map<string, Map<string, number>>,
  playerId: string,
  opponentId: string,
): HeadToHeadStats {
  const pairWins = winsByPair.get(getPairKey(playerId, opponentId));

  return {
    playerWins: pairWins?.get(playerId) ?? 0,
    opponentWins: pairWins?.get(opponentId) ?? 0,
    draws: pairWins?.get("draws") ?? 0,
  };
}

async function fetchRecentMatchesByPlayer(playerIds: string[]) {
  if (!db || playerIds.length === 0)
    return new Map<string, RecentMatchSummary[]>();

  const recentMatches = (await db
    .select({
      id: matches.id,
      playedOn: matches.playedOn,
      status: matches.status,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      confirmedAt: matches.confirmedAt,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(
        or(
          inArray(matches.player1Id, playerIds),
          inArray(matches.player2Id, playerIds),
        ),
        sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
      ),
    )
    .orderBy(
      desc(matches.playedOn),
      desc(matches.confirmedAt),
      desc(matches.createdAt),
    )
    .limit(Math.max(playerIds.length * 8, 40))) as Array<
    Omit<RecentMatchSummary, "sets"> & {
      confirmedAt: Date | null;
      createdAt: Date;
    }
  >;

  if (recentMatches.length === 0) return new Map();

  const recentMatchIds = recentMatches.map((match) => match.id);
  const setRows = await db
    .select({
      matchId: matchSets.matchId,
      setNumber: matchSets.setNumber,
      gamesP1: matchSets.gamesP1,
      gamesP2: matchSets.gamesP2,
      tiebreakP1: matchSets.tiebreakP1,
      tiebreakP2: matchSets.tiebreakP2,
    })
    .from(matchSets)
    .where(inArray(matchSets.matchId, recentMatchIds));

  const setsByMatch = new Map<string, typeof setRows>();
  for (const set of setRows) {
    const current = setsByMatch.get(set.matchId) ?? [];
    current.push(set);
    setsByMatch.set(set.matchId, current);
  }

  return groupRecentMatchesByPlayer(
    recentMatches.map(
      ({ confirmedAt: _confirmedAt, createdAt: _createdAt, ...match }) => ({
        ...match,
        sets: (setsByMatch.get(match.id) ?? []).sort(
          (a, b) => a.setNumber - b.setNumber,
        ),
      }),
    ),
  );
}

async function buildPlayerStatsById(
  matchPlayers: DrawPlayer[],
  recentMatchesByPlayer: Map<string, RecentMatchSummary[]>,
) {
  const [hombresRanking, mujeresRanking] = await Promise.all([
    getRanking("hombres"),
    getRanking("mujeres"),
  ]);
  const rankingById = new Map(
    [...hombresRanking, ...mujeresRanking].map((entry) => [entry.id, entry]),
  );

  return new Map(
    matchPlayers.map((player) => {
      const ranking = rankingById.get(player.id);
      const recentMatches = recentMatchesByPlayer.get(player.id) ?? [];

      return [
        player.id,
        ranking
          ? {
              position: ranking.position,
              points: ranking.points,
              weeklyDelta: ranking.weeklyDelta,
              matchesPlayed: ranking.matchesPlayed,
              matchesWon: ranking.matchesWon,
              matchesLost: ranking.matchesLost,
              recentForm: recentMatches
                .slice(0, 5)
                .map((match) => getRecentResult(match, player.id)),
            }
          : undefined,
      ];
    }),
  );
}

async function sendDrawEmailsForMatches(
  week: { startsOn: string; endsOn: string },
  drawMatches: DrawMatch[],
) {
  const dbClient = db;

  if (!dbClient) {
    return { sent: 0, skipped: 0, failed: 0, reason: "db_not_configured" };
  }

  const playerIds = [
    ...new Set(
      drawMatches.flatMap((match) => [match.player1Id, match.player2Id]),
    ),
  ];

  if (playerIds.length === 0) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const matchPlayers = await dbClient
    .select({
      id: players.id,
      fullName: players.fullName,
      email: players.email,
      gender: players.gender,
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
  const recentMatchesByPlayer = await fetchRecentMatchesByPlayer(playerIds);
  const headToHeadByPair = await fetchHeadToHeadByPair(drawMatches);
  const statsByPlayerId = await buildPlayerStatsById(
    matchPlayers,
    recentMatchesByPlayer,
  );
  const getOtherMatches = (currentMatchId: string): OtherWeekMatch[] =>
    drawMatches
      .filter((match) => match.id !== currentMatchId)
      .map((match) => {
        const player1 = playersById.get(match.player1Id);
        const player2 = playersById.get(match.player2Id);

        return player1 && player2
          ? {
              id: match.id,
              player1Name: player1.fullName,
              player2Name: player2.fullName,
              player1Ranking: statsByPlayerId.get(player1.id)?.position ?? null,
              player2Ranking: statsByPlayerId.get(player2.id)?.position ?? null,
            }
          : null;
      })
      .filter((match): match is OtherWeekMatch => Boolean(match));
  const deliveries = drawMatches.flatMap((match) => {
    const player1 = playersById.get(match.player1Id);
    const player2 = playersById.get(match.player2Id);

    if (!player1 || !player2) {
      return [];
    }

    return [
      {
        player: player1,
        opponent: player2,
        match,
        playerStats: statsByPlayerId.get(player1.id),
        opponentStats: statsByPlayerId.get(player2.id),
        headToHeadStats: getHeadToHeadStats(
          headToHeadByPair,
          player1.id,
          player2.id,
        ),
        opponentRecentMatches: recentMatchesByPlayer.get(player2.id),
        otherMatches: getOtherMatches(match.id),
        recommendedTimes: getRecommendedTimeOptions(
          player1,
          player2,
          week.startsOn,
        ),
      },
      {
        player: player2,
        opponent: player1,
        match,
        playerStats: statsByPlayerId.get(player2.id),
        opponentStats: statsByPlayerId.get(player1.id),
        headToHeadStats: getHeadToHeadStats(
          headToHeadByPair,
          player2.id,
          player1.id,
        ),
        opponentRecentMatches: recentMatchesByPlayer.get(player1.id),
        otherMatches: getOtherMatches(match.id),
        recommendedTimes: getRecommendedTimeOptions(
          player2,
          player1,
          week.startsOn,
        ),
      },
    ];
  });

  const testDeliveries = env.emailTestRecipient
    ? deliveries.slice(0, 1)
    : deliveries;
  const results = [];

  for (const delivery of testDeliveries) {
    await wait(250);
    results.push(
      await sendDrawEmail({
        ...delivery,
        weekStartsOn: week.startsOn,
        weekEndsOn: week.endsOn,
      }),
    );
  }

  return {
    sent: results.filter((result) => result === "sent").length,
    skipped: results.filter((result) => result === "skipped").length,
    failed: results.filter((result) => result === "failed").length,
    suppressed: deliveries.length - testDeliveries.length,
  };
}

function getEmailConfigIssue() {
  if (!env.emailsEnabled) {
    return "emails_disabled" as const;
  }

  if (!env.resendApiKey || !env.emailFrom) {
    console.warn(
      "Email notifications are enabled but RESEND_API_KEY or EMAIL_FROM is missing.",
    );
    return "email_env_missing" as const;
  }

  if (!db) {
    return "db_not_configured" as const;
  }

  return null;
}

export async function notifyFixturePublished(weekId: string) {
  const configIssue = getEmailConfigIssue();

  if (configIssue) {
    return { sent: 0, skipped: 0, failed: 0, reason: configIssue };
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
      category: matches.category,
    })
    .from(matches)
    .where(
      and(
        eq(matches.weekId, weekId),
        eq(matches.type, "sorteo"),
        eq(matches.status, "pendiente"),
      ),
    );

  return sendDrawEmailsForMatches(week, drawMatches);
}

async function getFallbackWeekForManualDraw() {
  if (!db) {
    return null;
  }

  const today = getTodayInSantiago();
  const [week] = await db
    .select({
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
    })
    .from(weeks)
    .where(
      and(
        inArray(weeks.status, ["abierta", "borrador"]),
        sql`${weeks.endsOn} >= ${today}`,
      ),
    )
    .orderBy(
      sql`case when ${weeks.status} = 'abierta' then 0 else 1 end`,
      weeks.startsOn,
    )
    .limit(1);

  return week ?? null;
}

export async function notifyManualDrawMatchCreated(matchId: string) {
  const configIssue = getEmailConfigIssue();

  if (configIssue) {
    return { sent: 0, skipped: 0, failed: 0, reason: configIssue };
  }

  if (!db) {
    return { sent: 0, skipped: 0, failed: 0, reason: "db_not_configured" };
  }

  const [match] = await db
    .select({
      id: matches.id,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      category: matches.category,
      type: matches.type,
      status: matches.status,
      weekStartsOn: weeks.startsOn,
      weekEndsOn: weeks.endsOn,
    })
    .from(matches)
    .leftJoin(weeks, eq(matches.weekId, weeks.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) {
    return { sent: 0, skipped: 0, failed: 0, reason: "match_not_found" };
  }

  if (match.type !== "sorteo" || match.status !== "pendiente") {
    return { sent: 0, skipped: 0, failed: 0, reason: "not_pending_draw" };
  }

  const week =
    match.weekStartsOn && match.weekEndsOn
      ? { startsOn: match.weekStartsOn, endsOn: match.weekEndsOn }
      : await getFallbackWeekForManualDraw();

  if (!week) {
    return { sent: 0, skipped: 0, failed: 0, reason: "week_not_found" };
  }

  return sendDrawEmailsForMatches(week, [
    {
      id: match.id,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      category: match.category,
    },
  ]);
}
