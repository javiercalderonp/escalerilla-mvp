import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { buildAvailabilityReminderEmail } from "@/lib/email/availability-reminder";
import { buildChallengeEmail } from "@/lib/email/challenge";
import { buildInactivityWarningEmail } from "@/lib/email/inactivity-warning";
import {
  buildMatchDrawEmail,
  type DrawMatch,
  type DrawPlayer,
} from "@/lib/email/match-draw";
import {
  buildMatchResultEmail,
  type MatchResultEmailDetails,
} from "@/lib/email/match-result";
import { buildWelcomeEmail } from "@/lib/email/welcome";

type EmailPreviewKey =
  | "availability"
  | "fixture"
  | "result_reporter"
  | "result_opponent"
  | "welcome"
  | "inactivity"
  | "challenge";

type EmailPreview = {
  key: EmailPreviewKey;
  label: string;
  description: string;
  subject: string;
  text: string;
  html: string;
};

const samplePlayer: DrawPlayer = {
  id: "player-1",
  fullName: "Agustin Achondo",
  email: "agustin@example.com",
  gender: "M",
  availMonday: true,
  availTuesday: false,
  availWednesday: true,
  availThursday: false,
  availFriday: true,
  availSaturday: false,
  availSunday: false,
  alwaysAvailable: false,
  visibility: null,
};

const sampleOpponent: DrawPlayer = {
  id: "player-2",
  fullName: "Benjamin Silva",
  email: "benjamin@example.com",
  gender: "M",
  availMonday: false,
  availTuesday: true,
  availWednesday: true,
  availThursday: true,
  availFriday: false,
  availSaturday: true,
  availSunday: false,
  alwaysAvailable: false,
  visibility: null,
};

const sampleMatch: DrawMatch = {
  id: "match-preview",
  player1Id: samplePlayer.id,
  player2Id: sampleOpponent.id,
  category: "M",
};

const sampleResult: MatchResultEmailDetails = {
  id: "match-result-preview",
  status: "confirmado",
  type: "sorteo",
  playedOn: "2026-05-14",
  winnerId: samplePlayer.id,
  woLoserId: null,
  reportedByPlayerId: samplePlayer.id,
  player1: {
    id: samplePlayer.id,
    fullName: samplePlayer.fullName,
    email: samplePlayer.email,
    rankingPosition: 10,
    points: 1542,
    weeklyDelta: 48,
  },
  player2: {
    id: sampleOpponent.id,
    fullName: sampleOpponent.fullName,
    email: sampleOpponent.email,
    rankingPosition: 18,
    points: 1180,
    weeklyDelta: -8,
  },
  sets: [
    {
      setNumber: 1,
      gamesP1: 6,
      gamesP2: 4,
      tiebreakP1: null,
      tiebreakP2: null,
    },
    {
      setNumber: 2,
      gamesP1: 7,
      gamesP2: 6,
      tiebreakP1: 7,
      tiebreakP2: 4,
    },
  ],
};

function makePreviews(): EmailPreview[] {
  const availability = buildAvailabilityReminderEmail({
    playerName: samplePlayer.fullName,
    weekStartsOn: "2026-05-18",
    weekEndsOn: "2026-05-24",
    deadline: "2026-05-15",
  });
  const fixture = buildMatchDrawEmail({
    player: samplePlayer,
    opponent: sampleOpponent,
    match: sampleMatch,
    weekStartsOn: "2026-05-18",
    weekEndsOn: "2026-05-24",
    playerStats: {
      position: 7,
      points: 138,
      weeklyDelta: 12,
      matchesPlayed: 9,
      matchesWon: 6,
      matchesLost: 3,
      recentForm: ["W", "W", "L", "D"],
    },
    opponentStats: {
      position: 5,
      points: 151,
      weeklyDelta: -4,
      matchesPlayed: 11,
      matchesWon: 7,
      matchesLost: 4,
      recentForm: ["L", "W", "W", "W", "L"],
    },
    headToHeadStats: {
      playerWins: 1,
      opponentWins: 0,
      draws: 0,
    },
    otherMatches: [
      {
        id: "other-1",
        player1Name: "Javier Calderon",
        player2Name: "Nicolas Rojas",
        player1Ranking: 8,
        player2Ranking: 15,
      },
      {
        id: "other-2",
        player1Name: "Matias Perez",
        player2Name: "Diego Araya",
        player1Ranking: 5,
        player2Ranking: 21,
      },
      {
        id: "other-3",
        player1Name: "Felipe Undurraga",
        player2Name: "Tomas Echeverria",
        player1Ranking: 9,
        player2Ranking: 16,
      },
    ],
    opponentRecentMatches: [
      {
        id: "recent-1",
        playedOn: "2026-05-10",
        status: "confirmado",
        winnerId: sampleOpponent.id,
        player1Id: sampleOpponent.id,
        player2Id: "player-3",
        player1Name: sampleOpponent.fullName,
        player2Name: "Carlos Rojas",
        sets: [
          {
            setNumber: 1,
            gamesP1: 6,
            gamesP2: 4,
            tiebreakP1: null,
            tiebreakP2: null,
          },
          {
            setNumber: 2,
            gamesP1: 7,
            gamesP2: 6,
            tiebreakP1: 7,
            tiebreakP2: 5,
          },
        ],
      },
    ],
  });
  const resultReporter = buildMatchResultEmail(sampleResult, {
    email: samplePlayer.email ?? "",
    kind: "player",
    name: samplePlayer.fullName,
    playerId: samplePlayer.id,
  });
  const resultOpponent = buildMatchResultEmail(sampleResult, {
    email: sampleOpponent.email ?? "",
    kind: "player",
    name: sampleOpponent.fullName,
    playerId: sampleOpponent.id,
  });
  const welcome = buildWelcomeEmail(samplePlayer.fullName);
  const inactivity = buildInactivityWarningEmail({
    playerId: samplePlayer.id,
    fullName: samplePlayer.fullName,
    email: samplePlayer.email,
    daysSince: 26,
    lastMatchDate: "2026-04-18",
  });
  const challenge = buildChallengeEmail({
    challengedName: sampleOpponent.fullName,
    challengerName: samplePlayer.fullName,
    deadline: new Date("2026-05-21T12:00:00Z"),
  });

  return [
    {
      key: "availability",
      label: "Disponibilidad",
      description: "Recordatorio para marcar disponibilidad semanal.",
      ...availability,
    },
    {
      key: "fixture",
      label: "Sorteo publicado",
      description: "Aviso al jugador cuando se publica el fixture.",
      ...fixture,
    },
    {
      key: "result_reporter",
      label: "Resultado - reportante",
      description: "Confirmacion para quien subio el resultado.",
      ...resultReporter,
    },
    {
      key: "result_opponent",
      label: "Resultado - rival",
      description: "Aviso al rival cuando otro jugador sube el resultado.",
      ...resultOpponent,
    },
    {
      key: "welcome",
      label: "Bienvenida",
      description: "Email al completar onboarding.",
      ...welcome,
    },
    {
      key: "inactivity",
      label: "Inactividad",
      description: "Advertencia antes de la penalidad mensual.",
      ...inactivity,
    },
    {
      key: "challenge",
      label: "Desafio",
      description: "Notificacion al jugador retado.",
      ...challenge,
    },
  ];
}

export default async function AdminEmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const isLocalPreview = process.env.NODE_ENV !== "production";

  if (!isLocalPreview) {
    const session = await auth();

    if (!session?.user) redirect("/login");
    if (session.user.role !== "admin") redirect("/");
  }

  const params = await searchParams;
  const previews = makePreviews();
  const selected =
    previews.find((preview) => preview.key === params.tipo) ?? previews[0];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Admin</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Preview de emails
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Revisa el HTML final de cada template sin enviar correos ni crear
            eventos.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        >
          Volver al admin
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {previews.map((preview) => {
            const active = preview.key === selected.key;

            return (
              <Link
                key={preview.key}
                href={`/admin/emails/preview?tipo=${preview.key}`}
                className={`block rounded-lg border px-4 py-3 text-sm transition ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="block font-semibold">{preview.label}</span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    active ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {preview.description}
                </span>
              </Link>
            );
          })}
        </aside>

        <section className="min-w-0">
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Asunto
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              {selected.subject}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <iframe
              title={`Preview ${selected.label}`}
              srcDoc={selected.html}
              className="h-[760px] w-full bg-white"
            />
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Ver texto plano
            </summary>
            <pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {selected.text}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
