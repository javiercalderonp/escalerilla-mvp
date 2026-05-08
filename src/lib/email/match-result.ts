import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { matches, matchSets, players } from "@/lib/db/schema";
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

type EmailRecipient = {
  email: string;
  kind: "admin" | "player";
  name?: string;
};

const RESEND_EMAIL_API_URL = "https://api.resend.com/emails";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function uniqueRecipients(recipients: EmailRecipient[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const email = normalizeEmail(recipient.email);

    if (!email || seen.has(email)) {
      return false;
    }

    seen.add(email);
    recipient.email = email;
    return true;
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  const baseUrl = env.appUrl.replace(/\/$/, "");

  if (recipientKind === "admin") {
    return `${baseUrl}/fixture`;
  }

  return `${baseUrl}/mi-perfil/partidos/${matchId}`;
}

function buildMessage(
  details: MatchResultEmailDetails,
  recipientKind: EmailRecipient["kind"],
) {
  const title = `Resultado registrado: ${details.player1.fullName} vs ${details.player2.fullName}`;
  const matchUrl = buildMatchUrl(details.id, recipientKind);
  const textLines = [
    title,
    "",
    `${formatType(details.type)} - ${formatDate(details.playedOn)}`,
    formatOutcome(details),
    `Marcador: ${formatScore(details)}`,
    "",
    `Ver partido: ${matchUrl}`,
  ];

  const htmlLines = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(formatType(details.type))} - ${escapeHtml(formatDate(details.playedOn))}</p>`,
    `<p><strong>${escapeHtml(formatOutcome(details))}</strong></p>`,
    `<p>Marcador: ${escapeHtml(formatScore(details))}</p>`,
    `<p><a href="${escapeHtml(matchUrl)}">Ver partido</a></p>`,
  ];

  return {
    subject: title,
    text: textLines.join("\n"),
    html: htmlLines.join("\n"),
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

  const [player1, player2, sets] = await Promise.all([
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
    player1: player1[0],
    player2: player2[0],
    sets: sets.sort((a, b) => a.setNumber - b.setNumber),
  } satisfies MatchResultEmailDetails;
}

async function sendEmail(
  recipient: EmailRecipient,
  details: MatchResultEmailDetails,
) {
  const message = buildMessage(details, recipient.kind);

  const response = await fetch(RESEND_EMAIL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.matchResultEmailFrom,
      to: [recipient.email],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend ${response.status}: ${responseText}`);
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
      },
      {
        email: details.player2.email ?? "",
        kind: "player" as const,
        name: details.player2.fullName,
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
