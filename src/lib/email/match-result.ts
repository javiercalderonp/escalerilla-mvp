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

type MatchSet = {
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

type MatchResultEmailDetails = {
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
  };
  player2: {
    id: string;
    fullName: string;
    email: string | null;
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

function buildMessage(
  details: MatchResultEmailDetails,
  recipient: EmailRecipient,
) {
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
<h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#0d1b2a;line-height:1.3;">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;font-size:15px;color:#0d1b2a;line-height:1.6;">${escapeHtml(intro)}</p>
<div style="background-color:#f6f2ea;border-radius:8px;border:1px solid #ded6ca;padding:20px 24px;margin:0 0 28px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Tipo · Fecha</p>
  <p style="margin:0 0 16px;font-size:14px;color:#0d1b2a;">${escapeHtml(formatType(details.type))} · ${escapeHtml(formatDate(details.playedOn))}</p>
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Resultado</p>
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0d1b2a;">${escapeHtml(formatOutcome(details))}</p>
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#776f66;text-transform:uppercase;letter-spacing:0.07em;">Marcador</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#0d1b2a;">${escapeHtml(score)}</p>
</div>
<a href="${escapeHtml(matchUrl)}" style="display:inline-block;padding:13px 28px;background-color:#0d1b2a;color:#fffdfa;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;line-height:1;">Ver partido</a>`;

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

  return {
    id: match.id,
    status: match.status,
    type: match.type,
    playedOn: match.playedOn,
    winnerId: match.winnerId,
    woLoserId: match.woLoserId,
    reportedByPlayerId: reporter[0]?.playerId ?? null,
    player1: player1[0],
    player2: player2[0],
    sets: sets.sort((a, b) => a.setNumber - b.setNumber),
  } satisfies MatchResultEmailDetails;
}

async function sendEmail(
  recipient: EmailRecipient,
  details: MatchResultEmailDetails,
) {
  const message = buildMessage(details, recipient);
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
