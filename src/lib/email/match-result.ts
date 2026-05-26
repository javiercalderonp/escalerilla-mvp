import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { matches, matchSets, players, users } from "@/lib/db/schema";
import {
  makeEmailDedupeKey,
  markEmailEventFailed,
  markEmailEventSent,
  reserveEmailEvent,
} from "@/lib/email/events";
import {
  absoluteUrl,
  buildEmailLayout,
  type EmailRecipient,
  escapeHtml,
  sendTransactionalEmail,
  uniqueRecipients,
} from "@/lib/email/shared";
import { env } from "@/lib/env";
import { getFreshRanking, rankingCategoryFromGender } from "@/lib/ranking";

export type MatchSet = {
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

export type MatchResultEmailDetails = {
  id: string;
  status: "confirmado" | "wo" | "empate";
  type: "sorteo" | "desafio" | "campeonato";
  playedOn: string | null;
  winnerId: string | null;
  woLoserId: string | null;
  reportedByPlayerId: string | null;
  player1: {
    id: string;
    fullName: string;
    email: string | null;
    rankingPosition?: number | null;
    points?: number | null;
    weeklyDelta?: number | null;
  };
  player2: {
    id: string;
    fullName: string;
    email: string | null;
    rankingPosition?: number | null;
    points?: number | null;
    weeklyDelta?: number | null;
  };
  sets: MatchSet[];
};

function formatType(type: MatchResultEmailDetails["type"]) {
  const labels: Record<MatchResultEmailDetails["type"], string> = {
    sorteo: "Sorteo",
    desafio: "Desafio",
    campeonato: "Campeonato",
  };

  return labels[type];
}

function formatDate(value: string | null) {
  if (!value) {
    return "Fecha no informada";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function formatLongDate(value: string | null) {
  if (!value) {
    return "fecha no informada";
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    timeZone: "America/Santiago",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatSet(set: MatchSet) {
  const tieBreak =
    set.tiebreakP1 != null && set.tiebreakP2 != null
      ? ` (${set.tiebreakP1}-${set.tiebreakP2})`
      : "";

  return `${set.gamesP1}-${set.gamesP2}${tieBreak}`;
}

function formatScore(details: MatchResultEmailDetails) {
  if (details.status === "wo") {
    const winner =
      details.winnerId === details.player1.id
        ? details.player1.fullName
        : details.player2.fullName;
    const loser =
      details.woLoserId === details.player1.id
        ? details.player1.fullName
        : details.player2.fullName;

    return `W.O.: gana ${winner}; pierde ${loser}`;
  }

  if (details.status === "empate") {
    return `Empate ${details.sets.map(formatSet).join(", ")}`;
  }

  return details.sets.map(formatSet).join(", ");
}

function formatOutcome(details: MatchResultEmailDetails) {
  if (details.status === "empate") {
    return "Resultado: empate";
  }

  const winner =
    details.winnerId === details.player1.id
      ? details.player1.fullName
      : details.player2.fullName;

  return `Ganador: ${winner}`;
}

function getPlayerSetValue(
  set: MatchSet,
  playerId: string,
  details: MatchResultEmailDetails,
) {
  const games = playerId === details.player1.id ? set.gamesP1 : set.gamesP2;
  const tieBreak =
    playerId === details.player1.id ? set.tiebreakP1 : set.tiebreakP2;

  return tieBreak == null ? String(games) : `${games} (${tieBreak})`;
}

function getSetsWon(details: MatchResultEmailDetails, playerId: string) {
  if (details.status === "wo") {
    return details.winnerId === playerId ? "W.O." : "0";
  }

  const setsWon = details.sets.filter((set) => {
    if (set.gamesP1 === set.gamesP2) return false;
    const setWinnerId =
      set.gamesP1 > set.gamesP2 ? details.player1.id : details.player2.id;
    return setWinnerId === playerId;
  }).length;

  if (details.status === "empate" && setsWon === 0) {
    return "1";
  }

  return String(setsWon);
}

function getCompactScore(details: MatchResultEmailDetails) {
  if (details.status === "wo") {
    return "W.O.";
  }

  return details.sets.length > 0
    ? `(${details.sets.map(formatSet).join(", ")})`
    : "";
}

function getSetsScoreHtml(details: MatchResultEmailDetails) {
  return `${escapeHtml(getSetsWon(details, details.player1.id))}&nbsp;-&nbsp;${escapeHtml(getSetsWon(details, details.player2.id))}`;
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";

  return `${first}${last}`.toUpperCase() || "CL";
}

function getPlayerRankingText(
  player: MatchResultEmailDetails["player1"],
  fallback = "-",
) {
  if (player.rankingPosition == null) {
    return fallback;
  }

  return `${player.rankingPosition}°`;
}

function getPointsText(player: MatchResultEmailDetails["player1"]) {
  if (player.points == null) {
    return "-";
  }

  return new Intl.NumberFormat("es-CL").format(player.points);
}

function getWeeklyDeltaText(player: MatchResultEmailDetails["player1"]) {
  if (player.weeklyDelta == null) {
    return null;
  }

  if (player.weeklyDelta > 0) return `+ ${player.weeklyDelta} puntos`;
  if (player.weeklyDelta < 0) return `${player.weeklyDelta} puntos`;
  return "Sin variacion semanal";
}

function buildAvatar(initials: string, align: "left" | "right") {
  return `<td width="68" ${align === "right" ? 'align="right"' : ""} style="width:68px;">
    <div style="width:62px;height:62px;border-radius:50%;background-color:#d8e1ea;color:#0d1b2a;font-size:21px;font-weight:800;line-height:62px;text-align:center;">${escapeHtml(initials)}</div>
  </td>`;
}

function buildScoreRows(details: MatchResultEmailDetails) {
  if (details.status === "wo") {
    const player1Value = details.winnerId === details.player1.id ? "W.O." : "-";
    const player2Value = details.winnerId === details.player2.id ? "W.O." : "-";

    return `
      <tr>
        <td style="padding:10px 14px;font-size:11px;font-weight:800;color:#5b6675;text-transform:uppercase;">Jugador</td>
        <td align="center" style="padding:10px 14px;font-size:11px;font-weight:800;color:#5b6675;text-transform:uppercase;">Resultado</td>
        <td align="center" style="padding:10px 14px;font-size:11px;font-weight:800;color:#5b6675;text-transform:uppercase;">Set 2</td>
        <td align="center" style="padding:10px 14px;font-size:11px;font-weight:800;color:#5b6675;text-transform:uppercase;">Set 3</td>
      </tr>
      <tr>
        <td style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;font-weight:700;">${escapeHtml(details.player1.fullName)}</td>
        <td align="center" style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;">${player1Value}</td>
        <td align="center" style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;">-</td>
        <td align="center" style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;">-</td>
      </tr>
      <tr>
        <td style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;font-weight:700;">${escapeHtml(details.player2.fullName)}</td>
        <td align="center" style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;">${player2Value}</td>
        <td align="center" style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;">-</td>
        <td align="center" style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;">-</td>
      </tr>`;
  }

  const setHeaders = [1, 2, 3]
    .map(
      (setNumber) =>
        `<td align="center" style="padding:10px 14px;font-size:11px;font-weight:800;color:#5b6675;text-transform:uppercase;">Set ${setNumber}</td>`,
    )
    .join("");
  const playerRow = (player: MatchResultEmailDetails["player1"]) =>
    [0, 1, 2]
      .map((index) => {
        const set = details.sets[index];
        const value = set ? getPlayerSetValue(set, player.id, details) : "-";

        return `<td align="center" style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;">${escapeHtml(value)}</td>`;
      })
      .join("");

  return `
    <tr>
      <td style="padding:10px 14px;font-size:11px;font-weight:800;color:#5b6675;text-transform:uppercase;">Jugador</td>
      ${setHeaders}
    </tr>
    <tr>
      <td style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;font-weight:700;">${escapeHtml(details.player1.fullName)}</td>
      ${playerRow(details.player1)}
    </tr>
    <tr>
      <td style="padding:11px 14px;border-top:1px solid #e8edf3;font-size:13px;color:#102033;font-weight:700;">${escapeHtml(details.player2.fullName)}</td>
      ${playerRow(details.player2)}
    </tr>`;
}

function buildMatchUrl(matchId: string, recipientKind: EmailRecipient["kind"]) {
  if (recipientKind === "admin") {
    return absoluteUrl("/fixture");
  }

  return absoluteUrl(`/mi-perfil/partidos/${matchId}`);
}

function getOpponentName(details: MatchResultEmailDetails, playerId: string) {
  return playerId === details.player1.id
    ? details.player2.fullName
    : details.player1.fullName;
}

function getReporterName(details: MatchResultEmailDetails) {
  if (details.reportedByPlayerId === details.player1.id) {
    return details.player1.fullName;
  }

  if (details.reportedByPlayerId === details.player2.id) {
    return details.player2.fullName;
  }

  return null;
}

function buildPlayerIntro(
  details: MatchResultEmailDetails,
  recipient: EmailRecipient,
) {
  if (!recipient.playerId) {
    return `Se registró el resultado de ${details.player1.fullName} vs ${details.player2.fullName}.`;
  }

  const opponentName = getOpponentName(details, recipient.playerId);

  if (details.reportedByPlayerId === recipient.playerId) {
    return `Registraste el resultado de tu partido contra ${opponentName}. Si hay un error, contacta al admin.`;
  }

  const reporterName = getReporterName(details) ?? "Tu rival";

  return `${reporterName} ha subido el resultado de su partido contra ti. ¿Es correcto? Si no, contacta al admin.`;
}

function buildOpponentResultEmail(
  details: MatchResultEmailDetails,
  recipient: EmailRecipient,
) {
  const reporterName = getReporterName(details) ?? "Tu rival";
  const matchUrl = buildMatchUrl(details.id, recipient.kind);
  const winner =
    details.winnerId === details.player2.id ? details.player2 : details.player1;
  const recipientPlayer =
    recipient.playerId === details.player1.id
      ? details.player1
      : details.player2;
  const title = "Resultado reportado por tu rival";
  const intro = `${reporterName} ha registrado el resultado del partido disputado el ${formatLongDate(details.playedOn)}. Revísalo y confírmalo. Si hay algún error, puedes solicitar una edición.`;
  const compactScore = getCompactScore(details);
  const weeklyDelta = getWeeklyDeltaText(recipientPlayer);
  const homeUrl = absoluteUrl("/");
  const logoUrl = absoluteUrl("/logo.png");
  const bannerUrl = absoluteUrl("/imagen-mail.png");
  const rankingUrl = absoluteUrl("/ranking");
  const textLines = [
    title,
    "",
    intro,
    "",
    `${details.player1.fullName} ${getSetsWon(details, details.player1.id)} - ${getSetsWon(details, details.player2.id)} ${details.player2.fullName}`,
    compactScore
      ? `Marcador: ${compactScore}`
      : `Marcador: ${formatScore(details)}`,
    "",
    `Confirmar resultado: ${matchUrl}`,
    `Reportar un error: ${matchUrl}`,
  ];

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @media only screen and (max-width:480px){
      .em-shell-gutter{padding-left:10px!important;padding-right:10px!important;}
      .em-card-gutter{padding-left:10px!important;padding-right:10px!important;}
      .em-card-pad{padding:20px 12px 24px!important;}
      .em-hero{height:98px!important;padding-left:16px!important;padding-right:16px!important;}
      .em-hero-logo{width:42px!important;height:42px!important;}
      .em-hero-logo-cell{padding-right:10px!important;}
      .em-hero-title{font-size:15px!important;line-height:1.08!important;}
      .em-hero-subtitle{font-size:10px!important;line-height:1.2!important;}
      .em-email-heading{margin-bottom:14px!important;}
      .em-email-kicker{margin-bottom:8px!important;font-size:10px!important;letter-spacing:0.08em!important;line-height:1.2!important;}
      .em-email-title{font-size:22px!important;line-height:1.12!important;}
      .em-email-intro{margin-top:10px!important;margin-bottom:14px!important;font-size:12px!important;line-height:1.45!important;}
      .em-match-score{font-size:30px!important;white-space:nowrap!important;}
      .em-col-half{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:none!important;}
      .em-col-third{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:none!important;padding-top:8px!important;}
      .em-full-btn{display:block!important;width:100%!important;box-sizing:border-box!important;padding-left:0!important;padding-right:0!important;}
      .em-mobile-cta{display:block!important;width:auto!important;padding-top:12px!important;text-align:center!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fb;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f7fb;">
    <tr>
      <td align="center" class="em-shell-gutter" style="padding:16px 8px 24px;">
        <table width="720" cellpadding="0" cellspacing="0" role="presentation" style="width:720px;max-width:100%;background-color:#07182a;border:1px solid #e5eaf0;">
          <tr>
            <td background="${bannerUrl}" class="em-hero" style="background-color:#07182a;background-image:linear-gradient(90deg,rgba(7,24,42,0.94) 0%,rgba(7,24,42,0.82) 38%,rgba(7,24,42,0.34) 72%,rgba(7,24,42,0.08) 100%),url('${bannerUrl}');background-size:cover;background-position:center;height:154px;padding:0 40px;">
              <a href="${homeUrl}" style="text-decoration:none;">
                <table cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td class="em-hero-logo-cell" style="padding-right:22px;"><img src="${logoUrl}" alt="Club de Golf La Dehesa" width="70" height="70" class="em-hero-logo" style="display:block;border:0;border-radius:4px;"></td>
                    <td>
                      <div class="em-hero-title" style="font-size:24px;font-weight:900;color:#ffffff;line-height:1.1;text-transform:uppercase;">Club de Golf La Dehesa</div>
                      <div class="em-hero-subtitle" style="font-size:16px;font-weight:800;color:#ff7a1a;line-height:1.4;text-transform:uppercase;">Escalerilla Tenis</div>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" class="em-card-gutter" style="padding:0 36px 0;background:#07182a;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:-32px;background:#ffffff;border-radius:8px;box-shadow:0 14px 36px rgba(15,28,42,0.14);">
                <tr>
                  <td class="em-card-pad" style="padding:28px 34px 34px;">
                    <div class="em-email-heading" style="text-align:center;margin:0 0 20px;">
                      <p class="em-email-kicker" style="margin:0 0 12px;font-size:12px;font-weight:800;color:#3fa34d;letter-spacing:0.08em;text-transform:uppercase;">&#10003; Resultado reportado</p>
                      <h1 class="em-email-title" style="margin:0;font-size:26px;font-weight:900;color:#0d1b2a;line-height:1.15;">${escapeHtml(title)}</h1>
                      <p class="em-email-intro" style="margin:14px auto 0;max-width:560px;font-size:14px;color:#314156;line-height:1.55;">${escapeHtml(intro)}</p>
                    </div>

                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:8px;margin:0 0 16px;">
                      <tr>
                        <td style="padding:22px 26px 10px;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              ${buildAvatar(getInitials(details.player1.fullName), "left")}
                              <td style="padding-left:12px;">
                                <p style="margin:0 0 5px;font-size:16px;font-weight:900;color:#0d1b2a;line-height:1.3;">${escapeHtml(details.player1.fullName)}</p>
                                <p style="margin:0;font-size:12px;color:#5b6675;line-height:1.4;">Ranking actual<br><strong style="font-size:15px;color:#0d1b2a;">${escapeHtml(getPlayerRankingText(details.player1))}</strong></p>
                              </td>
                              <td align="center" style="padding:0 12px;width:160px;">
                                <div style="display:inline-block;background:#e8f6eb;color:#2b8b3f;font-size:11px;font-weight:900;text-transform:uppercase;border-radius:999px;padding:5px 10px;margin-bottom:8px;">${escapeHtml(details.status === "empate" ? "Empate" : winner.id === details.player1.id ? "Ganador" : "Resultado")}</div>
                                <div class="em-match-score" style="font-size:34px;line-height:1;font-weight:900;color:#07182a;white-space:nowrap;">${getSetsScoreHtml(details)}</div>
                                <div style="font-size:16px;font-weight:800;color:#0d1b2a;margin-top:7px;">${escapeHtml(compactScore)}</div>
                              </td>
                              <td align="right" style="padding-right:12px;">
                                <p style="margin:0 0 5px;font-size:16px;font-weight:900;color:#0d1b2a;line-height:1.3;">${escapeHtml(details.player2.fullName)}</p>
                                <p style="margin:0;font-size:12px;color:#5b6675;line-height:1.4;">Ranking actual<br><strong style="font-size:15px;color:#0d1b2a;">${escapeHtml(getPlayerRankingText(details.player2))}</strong></p>
                              </td>
                              ${buildAvatar(getInitials(details.player2.fullName), "right")}
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 28px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e8edf3;border-radius:7px;border-collapse:separate;border-spacing:0;overflow:hidden;">
                            ${buildScoreRows(details)}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fffaf6;border:1px solid #ffd4b8;border-radius:8px;margin:0 0 22px;">
                      <tr>
                        <td width="50" style="padding:16px 0 16px 18px;font-size:28px;color:#f97316;">&#9888;</td>
                        <td valign="middle" style="padding:16px 12px;">
                          <p style="margin:0;font-size:15px;font-weight:900;color:#0d1b2a;">¿Hay algún error en el resultado?</p>
                          <p style="margin:3px 0 0;font-size:13px;color:#314156;">Si los sets o el marcador no son correctos, puedes solicitar una corrección al administrador.</p>
                        </td>
                        <td align="right" valign="middle" width="190" class="em-mobile-cta" style="width:190px;padding:16px 18px 16px 8px;">
                          <a href="${escapeHtml(matchUrl)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;border:1px solid #f97316;border-radius:6px;padding:11px 18px;font-size:13px;font-weight:900;line-height:1;text-align:center;white-space:nowrap;">Reportar error</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 12px;font-size:14px;font-weight:900;color:#0d1b2a;text-transform:uppercase;">Tu ranking actualizado</p>
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                      <tr>
                        <td width="33.33%" class="em-col-third" style="padding-right:10px;">
                          <div style="border:1px solid #e5eaf0;border-radius:7px;padding:14px;text-align:center;">
                            <div style="font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;">Tu posición</div>
                            <div style="font-size:24px;font-weight:900;color:#0d1b2a;margin-top:5px;">${escapeHtml(getPlayerRankingText(recipientPlayer))}</div>
                          </div>
                        </td>
                        <td width="33.33%" class="em-col-third" style="padding:0 5px;">
                          <div style="border:1px solid #e5eaf0;border-radius:7px;padding:14px;text-align:center;">
                            <div style="font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;">Puntos actuales</div>
                            <div style="font-size:24px;font-weight:900;color:#0d1b2a;margin-top:5px;">${escapeHtml(getPointsText(recipientPlayer))}</div>
                            <div style="font-size:12px;font-weight:800;color:#35a852;">${escapeHtml(weeklyDelta ?? "Actualizado")}</div>
                          </div>
                        </td>
                        <td width="33.33%" class="em-col-third" style="padding-left:10px;">
                          <div style="border:1px solid #e5eaf0;border-radius:7px;padding:14px;text-align:center;">
                            <div style="font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;">Próximo sorteo</div>
                            <div style="font-size:13px;font-weight:800;color:#0d1b2a;margin-top:8px;">Lunes</div>
                            <div style="font-size:12px;color:#5b6675;">Se publicará por la noche</div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                      <tr>
                        <td width="50%" class="em-full-btn" style="padding-right:8px;"><a href="${rankingUrl}" style="display:block;background:#082033;color:#ffffff;text-decoration:none;border-radius:6px;text-align:center;padding:13px 16px;font-size:14px;font-weight:800;">Ver ranking completo</a></td>
                        <td width="50%" class="em-full-btn" style="padding-left:8px;"><a href="${escapeHtml(matchUrl)}" style="display:block;background:#ffffff;color:#0d1b2a;text-decoration:none;border:1px solid #0d1b2a;border-radius:6px;text-align:center;padding:12px 16px;font-size:14px;font-weight:800;">Ver mis partidos</a></td>
                      </tr>
                    </table>

                    <div style="background:#eff6ff;border:1px solid #d8e8ff;border-radius:7px;padding:14px 18px;color:#153e75;font-size:13px;line-height:1.45;">
                      <strong>Importante</strong><br>
                      Puedes aceptar el resultado o solicitar una corrección antes del sorteo de la próxima semana.
                    </div>

                    <img src="${logoUrl}" alt="Club de Golf La Dehesa" width="58" height="58" style="display:block;border:0;border-radius:4px;margin:24px auto 12px;">
                    <p style="margin:0 0 12px;text-align:center;font-size:14px;font-weight:900;color:#0d1b2a;">Escalerilla de Tenis Club de Golf La Dehesa</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="background-color:#082033;border-radius:0 0 8px 8px;padding:14px 20px;">
                    <p style="margin:0;font-size:13px;color:#cbd5e1;">Correo automático · Club Escalerilla · No responder</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: title,
    text: textLines.join("\n"),
    html,
  };
}

export function buildMatchResultEmail(
  details: MatchResultEmailDetails,
  recipient: EmailRecipient,
) {
  if (
    recipient.kind === "player" &&
    recipient.playerId &&
    details.reportedByPlayerId &&
    details.reportedByPlayerId !== recipient.playerId
  ) {
    return buildOpponentResultEmail(details, recipient);
  }

  const score = formatScore(details);
  const opponentName =
    recipient.kind === "player" && recipient.playerId
      ? getOpponentName(details, recipient.playerId)
      : null;
  const title = opponentName
    ? `Resultado registrado vs ${opponentName}`
    : `Resultado registrado: ${details.player1.fullName} vs ${details.player2.fullName}`;
  const intro =
    recipient.kind === "player"
      ? buildPlayerIntro(details, recipient)
      : `Resultado registrado para ${details.player1.fullName} vs ${details.player2.fullName}.`;
  const matchUrl = buildMatchUrl(details.id, recipient.kind);
  const winner =
    details.winnerId === details.player2.id ? details.player2 : details.player1;
  const recipientPlayer =
    recipient.playerId === details.player2.id
      ? details.player2
      : details.player1;
  const compactScore = getCompactScore(details);
  const weeklyDelta = getWeeklyDeltaText(recipientPlayer);
  const rankingUrl = absoluteUrl("/ranking");
  const textLines = [
    title,
    "",
    intro,
    "",
    `${formatType(details.type)} - ${formatDate(details.playedOn)}`,
    formatOutcome(details),
    `Marcador: ${score}`,
    "",
    `Ver partido: ${matchUrl}`,
  ];

  const innerHtml = `
<div class="em-email-heading" style="text-align:center;margin:0 0 20px;">
  <p class="em-email-kicker" style="margin:0 0 12px;font-size:12px;font-weight:800;color:#3fa34d;letter-spacing:0.08em;text-transform:uppercase;">&#10003; Resultado registrado</p>
  <h1 class="em-email-title" style="margin:0;font-size:26px;font-weight:900;color:#0d1b2a;line-height:1.15;">${escapeHtml(title)}</h1>
  <p class="em-email-intro" style="margin:14px auto 0;max-width:560px;font-size:14px;color:#314156;line-height:1.55;">${escapeHtml(intro)}</p>
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:8px;margin:0 0 16px;">
  <tr>
    <td style="padding:22px 26px 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          ${buildAvatar(getInitials(details.player1.fullName), "left")}
          <td style="padding-left:12px;">
            <p style="margin:0 0 5px;font-size:16px;font-weight:900;color:#0d1b2a;line-height:1.3;">${escapeHtml(details.player1.fullName)}</p>
            <p style="margin:0;font-size:12px;color:#5b6675;line-height:1.4;">Ranking actual<br><strong style="font-size:15px;color:#0d1b2a;">${escapeHtml(getPlayerRankingText(details.player1))}</strong></p>
          </td>
          <td align="center" style="padding:0 12px;width:160px;">
            <div style="display:inline-block;background:#e8f6eb;color:#2b8b3f;font-size:11px;font-weight:900;text-transform:uppercase;border-radius:999px;padding:5px 10px;margin-bottom:8px;">${escapeHtml(details.status === "empate" ? "Empate" : winner.id === details.player1.id ? "Ganador" : "Resultado")}</div>
            <div class="em-match-score" style="font-size:34px;line-height:1;font-weight:900;color:#07182a;white-space:nowrap;">${getSetsScoreHtml(details)}</div>
            <div style="font-size:16px;font-weight:800;color:#0d1b2a;margin-top:7px;">${escapeHtml(compactScore)}</div>
          </td>
          <td align="right" style="padding-right:12px;">
            <p style="margin:0 0 5px;font-size:16px;font-weight:900;color:#0d1b2a;line-height:1.3;">${escapeHtml(details.player2.fullName)}</p>
            <p style="margin:0;font-size:12px;color:#5b6675;line-height:1.4;">Ranking actual<br><strong style="font-size:15px;color:#0d1b2a;">${escapeHtml(getPlayerRankingText(details.player2))}</strong></p>
          </td>
          ${buildAvatar(getInitials(details.player2.fullName), "right")}
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 28px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e8edf3;border-radius:7px;border-collapse:separate;border-spacing:0;overflow:hidden;">
        ${buildScoreRows(details)}
      </table>
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fffaf6;border:1px solid #ffd4b8;border-radius:8px;margin:0 0 22px;">
  <tr>
    <td width="50" style="padding:16px 0 16px 18px;font-size:28px;color:#f97316;">&#9888;</td>
    <td valign="middle" style="padding:16px 12px;">
      <p style="margin:0;font-size:15px;font-weight:900;color:#0d1b2a;">¿Hay algún error en el resultado?</p>
      <p style="margin:3px 0 0;font-size:13px;color:#314156;">Si los sets o el marcador no son correctos, puedes solicitar una corrección al administrador.</p>
    </td>
    <td align="right" valign="middle" width="190" class="em-mobile-cta" style="width:190px;padding:16px 18px 16px 8px;">
      <a href="${escapeHtml(matchUrl)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;border:1px solid #f97316;border-radius:6px;padding:11px 18px;font-size:13px;font-weight:900;line-height:1;text-align:center;white-space:nowrap;">Reportar error</a>
    </td>
  </tr>
</table>

<p style="margin:0 0 12px;font-size:14px;font-weight:900;color:#0d1b2a;text-transform:uppercase;">Tu ranking actualizado</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
  <tr>
    <td width="33.33%" class="em-col-third" style="padding-right:10px;">
      <div style="border:1px solid #e5eaf0;border-radius:7px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;">Tu posición</div>
        <div style="font-size:24px;font-weight:900;color:#0d1b2a;margin-top:5px;">${escapeHtml(getPlayerRankingText(recipientPlayer))}</div>
      </div>
    </td>
    <td width="33.33%" class="em-col-third" style="padding:0 5px;">
      <div style="border:1px solid #e5eaf0;border-radius:7px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;">Puntos actuales</div>
        <div style="font-size:24px;font-weight:900;color:#0d1b2a;margin-top:5px;">${escapeHtml(getPointsText(recipientPlayer))}</div>
        <div style="font-size:12px;font-weight:800;color:#35a852;">${escapeHtml(weeklyDelta ?? "Actualizado")}</div>
      </div>
    </td>
    <td width="33.33%" class="em-col-third" style="padding-left:10px;">
      <div style="border:1px solid #e5eaf0;border-radius:7px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:#5b6675;text-transform:uppercase;">Próximo sorteo</div>
        <div style="font-size:13px;font-weight:800;color:#0d1b2a;margin-top:8px;">Lunes</div>
        <div style="font-size:12px;color:#5b6675;">Se publicará por la noche</div>
      </div>
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
  <tr>
    <td width="50%" class="em-full-btn" style="padding-right:8px;"><a href="${rankingUrl}" style="display:block;background:#082033;color:#ffffff;text-decoration:none;border-radius:6px;text-align:center;padding:13px 16px;font-size:14px;font-weight:800;">Ver ranking completo</a></td>
    <td width="50%" class="em-full-btn" style="padding-left:8px;"><a href="${escapeHtml(matchUrl)}" style="display:block;background:#ffffff;color:#0d1b2a;text-decoration:none;border:1px solid #0d1b2a;border-radius:6px;text-align:center;padding:12px 16px;font-size:14px;font-weight:800;">Ver mis partidos</a></td>
  </tr>
</table>

<div style="background:#eff6ff;border:1px solid #d8e8ff;border-radius:7px;padding:14px 18px;color:#153e75;font-size:13px;line-height:1.45;">
  <strong>Importante</strong><br>
  Puedes revisar el resultado o solicitar una corrección antes del sorteo de la próxima semana.
</div>`;

  return {
    subject: title,
    text: textLines.join("\n"),
    html: buildEmailLayout(title, innerHtml),
  };
}

async function loadMatchResultDetails(matchId: string) {
  const dbClient = db;

  if (!dbClient) {
    return null;
  }

  const [match] = await dbClient
    .select({
      id: matches.id,
      status: matches.status,
      type: matches.type,
      category: matches.category,
      playedOn: matches.playedOn,
      winnerId: matches.winnerId,
      woLoserId: matches.woLoserId,
      reportedById: matches.reportedById,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (
    !match ||
    (match.status !== "confirmado" &&
      match.status !== "wo" &&
      match.status !== "empate")
  ) {
    return null;
  }

  const [player1, player2, sets, reporter] = await Promise.all([
    dbClient
      .select({
        id: players.id,
        fullName: players.fullName,
        email: players.email,
      })
      .from(players)
      .where(eq(players.id, match.player1Id))
      .limit(1),
    dbClient
      .select({
        id: players.id,
        fullName: players.fullName,
        email: players.email,
      })
      .from(players)
      .where(eq(players.id, match.player2Id))
      .limit(1),
    dbClient
      .select({
        setNumber: matchSets.setNumber,
        gamesP1: matchSets.gamesP1,
        gamesP2: matchSets.gamesP2,
        tiebreakP1: matchSets.tiebreakP1,
        tiebreakP2: matchSets.tiebreakP2,
      })
      .from(matchSets)
      .where(eq(matchSets.matchId, match.id)),
    match.reportedById
      ? dbClient
          .select({ playerId: users.playerId })
          .from(users)
          .where(eq(users.id, match.reportedById))
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (!player1[0] || !player2[0]) {
    return null;
  }

  const ranking = await getFreshRanking(
    rankingCategoryFromGender(match.category),
  );
  const rankingByPlayerId = new Map(ranking.map((entry) => [entry.id, entry]));
  const player1Ranking = rankingByPlayerId.get(player1[0].id);
  const player2Ranking = rankingByPlayerId.get(player2[0].id);

  return {
    id: match.id,
    status: match.status,
    type: match.type,
    playedOn: match.playedOn,
    winnerId: match.winnerId,
    woLoserId: match.woLoserId,
    reportedByPlayerId: reporter[0]?.playerId ?? null,
    player1: {
      ...player1[0],
      rankingPosition: player1Ranking?.position ?? null,
      points: player1Ranking?.points ?? null,
      weeklyDelta: player1Ranking?.weeklyDelta ?? null,
    },
    player2: {
      ...player2[0],
      rankingPosition: player2Ranking?.position ?? null,
      points: player2Ranking?.points ?? null,
      weeklyDelta: player2Ranking?.weeklyDelta ?? null,
    },
    sets: sets.sort((a, b) => a.setNumber - b.setNumber),
  } satisfies MatchResultEmailDetails;
}

async function sendEmail(
  recipient: EmailRecipient,
  details: MatchResultEmailDetails,
) {
  const message = buildMatchResultEmail(details, recipient);
  const dedupeKey = makeEmailDedupeKey([
    "match_result",
    details.id,
    recipient.playerId ?? recipient.email,
  ]);
  const reserved = await reserveEmailEvent({
    type: "match_result",
    dedupeKey,
    recipientEmail: recipient.email,
    playerId: recipient.playerId ?? null,
    entityType: "match",
    entityId: details.id,
  });

  if (!reserved) {
    return;
  }

  try {
    await sendTransactionalEmail({
      to: recipient.email,
      from: env.matchResultEmailFrom || env.emailFrom,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    await markEmailEventSent(dedupeKey);
  } catch (error) {
    await markEmailEventFailed(dedupeKey, error);
    throw error;
  }
}

export async function notifyMatchResultRegistered(matchId: string) {
  if (!env.matchResultEmailsEnabled) {
    return;
  }

  if (!env.resendApiKey || !env.matchResultEmailFrom) {
    console.warn(
      "Match result email notifications are enabled but RESEND_API_KEY or MATCH_RESULT_EMAIL_FROM is missing.",
    );
    return;
  }

  try {
    const details = await loadMatchResultDetails(matchId);

    if (!details) {
      return;
    }

    const recipients = uniqueRecipients([
      ...env.adminEmails.map((email) => ({ email, kind: "admin" as const })),
      {
        email: details.player1.email ?? "",
        kind: "player" as const,
        name: details.player1.fullName,
        playerId: details.player1.id,
      },
      {
        email: details.player2.email ?? "",
        kind: "player" as const,
        name: details.player2.fullName,
        playerId: details.player2.id,
      },
    ]);

    if (recipients.length === 0) {
      return;
    }

    await Promise.all(
      recipients.map((recipient) => sendEmail(recipient, details)),
    );
  } catch (error) {
    console.error("Failed to send match result notification emails", error);
  }
}
