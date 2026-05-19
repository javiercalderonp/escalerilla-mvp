"use client";

import {
  AlertTriangle,
  Copy,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { buildFixtureMessage } from "@/lib/fixture/message";
import type { SerializedPair } from "./actions";
import { generateProposalAction, publishFixtureAction } from "./actions";

type ActivePlayer = {
  id: string;
  fullName: string;
  maxMatches: number;
  rankingPosition: number | null;
};

type DraftPair = SerializedPair & {
  draftId: string;
};

interface Props {
  weekId: string;
  weekLabel: string;
  allActivePlayersM: ActivePlayer[];
  allActivePlayersF: ActivePlayer[];
  initialPairsM: SerializedPair[];
  initialPairsF: SerializedPair[];
  hasPublishedMatches: boolean;
}

function withDraftId(pair: SerializedPair): DraftPair {
  return { ...pair, draftId: crypto.randomUUID() };
}

function formatPlayerOption(player: ActivePlayer) {
  return `${formatRanking(player.rankingPosition)} ${player.fullName}`;
}

function formatRanking(position: number | null) {
  return position ? `#${position}` : "S/R";
}

function getRankDiff(playerA?: ActivePlayer, playerB?: ActivePlayer) {
  if (!playerA?.rankingPosition || !playerB?.rankingPosition) return null;
  return Math.abs(playerA.rankingPosition - playerB.rankingPosition);
}

function canMakeChallenge(playerA?: ActivePlayer, playerB?: ActivePlayer) {
  const diff = getRankDiff(playerA, playerB);
  return diff !== null && diff <= 5;
}

function CategoryEditor({
  category,
  label,
  allActivePlayers,
  pairs,
  setPairs,
  weekId,
  isPending,
  startTransition,
}: {
  category: "M" | "F";
  label: string;
  allActivePlayers: ActivePlayer[];
  pairs: DraftPair[];
  setPairs: React.Dispatch<React.SetStateAction<DraftPair[]>>;
  weekId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const playersById = new Map(
    allActivePlayers.map((player) => [player.id, player]),
  );
  const availablePlayers = allActivePlayers.filter(
    (player) => player.maxMatches > 0,
  );

  const playerUsage = new Map<string, number>();
  for (const pair of pairs) {
    playerUsage.set(pair.p1Id, (playerUsage.get(pair.p1Id) ?? 0) + 1);
    playerUsage.set(pair.p2Id, (playerUsage.get(pair.p2Id) ?? 0) + 1);
  }

  const remainingPlayers = availablePlayers.filter(
    (player) => (playerUsage.get(player.id) ?? 0) < player.maxMatches,
  );

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateProposalAction(weekId, category);
        setPairs(result.map(withDraftId));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo generar la propuesta",
        );
      }
    });
  }

  function updatePair(index: number, field: "p1" | "p2", playerId: string) {
    const player = allActivePlayers.find((p) => p.id === playerId);
    if (!player) return;
    setPairs((prev) => {
      const next = [...prev];
      const pair = { ...next[index] };
      if (field === "p1") {
        pair.p1Id = player.id;
        pair.p1Name = player.fullName;
      } else {
        pair.p2Id = player.id;
        pair.p2Name = player.fullName;
      }
      if (
        !canMakeChallenge(
          playersById.get(pair.p1Id),
          playersById.get(pair.p2Id),
        )
      ) {
        pair.isChallenge = false;
      }
      next[index] = pair;
      return next;
    });
  }

  function updatePairChallenge(index: number, isChallenge: boolean) {
    setPairs((prev) => {
      const next = [...prev];
      const pair = { ...next[index] };
      const canChallenge = canMakeChallenge(
        playersById.get(pair.p1Id),
        playersById.get(pair.p2Id),
      );
      pair.isChallenge = canChallenge ? isChallenge : false;
      next[index] = pair;
      return next;
    });
  }

  function removePair(index: number) {
    setPairs((prev) => prev.filter((_, i) => i !== index));
  }

  function addPair() {
    const candidates =
      remainingPlayers.length >= 2 ? remainingPlayers : availablePlayers;
    if (candidates.length < 2) return;
    setPairs((prev) => [
      ...prev,
      {
        p1Id: candidates[0].id,
        p1Name: candidates[0].fullName,
        p2Id: candidates[1].id,
        p2Name: candidates[1].fullName,
        isChallenge: false,
        draftId: crypto.randomUUID(),
      },
    ]);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Singles
          </p>
          <h2 className="text-xl font-semibold text-slate-950">{label}</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleRegenerate}
          disabled={isPending}
          className="gap-2"
        >
          <RefreshCw className={isPending ? "animate-spin" : ""} />
          {isPending ? "Generando" : "Nuevo sorteo"}
        </Button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {pairs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
            No hay partidos. Regenerá la propuesta o agregá uno manual.
          </div>
        ) : (
          pairs.map((pair, index) => {
            const p1 = playersById.get(pair.p1Id);
            const p2 = playersById.get(pair.p2Id);
            const rankDiff = getRankDiff(p1, p2);
            const challengeEnabled = canMakeChallenge(p1, p2);

            return (
              <div
                key={pair.draftId}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Partido {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {formatRanking(p1?.rankingPosition ?? null)}{" "}
                      {pair.p1Name} vs{" "}
                      {formatRanking(p2?.rankingPosition ?? null)}{" "}
                      {pair.p2Name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {rankDiff === null
                        ? "Sin ranking suficiente para desafío"
                        : `Diferencia de ranking: ${rankDiff} posición${
                            rankDiff !== 1 ? "es" : ""
                          }`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removePair(index)}
                    title="Eliminar partido"
                    aria-label="Eliminar partido"
                  >
                    <Trash2 />
                  </Button>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <select
                    value={pair.p1Id}
                    onChange={(e) => updatePair(index, "p1", e.target.value)}
                    className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                  >
                    {allActivePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatPlayerOption(p)}
                      </option>
                    ))}
                  </select>
                  <span className="text-center text-xs font-semibold uppercase text-slate-400">
                    vs
                  </span>
                  <select
                    value={pair.p2Id}
                    onChange={(e) => updatePair(index, "p2", e.target.value)}
                    className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                  >
                    {allActivePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatPlayerOption(p)}
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  className={`mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                    challengeEnabled
                      ? "border-clay/30 bg-clay/5 text-slate-800"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <span className="font-medium">Hacer desafío</span>
                  <input
                    type="checkbox"
                    checked={Boolean(pair.isChallenge) && challengeEnabled}
                    disabled={!challengeEnabled}
                    onChange={(event) =>
                      updatePairChallenge(index, event.target.checked)
                    }
                    className="size-4 accent-clay disabled:cursor-not-allowed"
                  />
                </label>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        {availablePlayers.length >= 2 && (
          <Button
            type="button"
            variant="outline"
            onClick={addPair}
            className="gap-2"
          >
            <Plus />
            Agregar partido
          </Button>
        )}
      </div>
    </section>
  );
}

export function FixtureEditor({
  weekId,
  weekLabel,
  allActivePlayersM,
  allActivePlayersF,
  initialPairsM,
  initialPairsF,
  hasPublishedMatches,
}: Props) {
  const router = useRouter();
  const [pairsM, setPairsM] = useState<DraftPair[]>(() =>
    initialPairsM.map(withDraftId),
  );
  const [pairsF, setPairsF] = useState<DraftPair[]>(() =>
    initialPairsF.map(withDraftId),
  );
  const [isPublished, setIsPublished] = useState(hasPublishedMatches);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    setPublishError(null);
    startTransition(async () => {
      try {
        const allPairs = [
          ...pairsM.map((p) => ({
            player1Id: p.p1Id,
            player2Id: p.p2Id,
            category: "M" as const,
            isChallenge: Boolean(p.isChallenge),
          })),
          ...pairsF.map((p) => ({
            player1Id: p.p1Id,
            player2Id: p.p2Id,
            category: "F" as const,
            isChallenge: Boolean(p.isChallenge),
          })),
        ];
        await publishFixtureAction(weekId, allPairs);
        setIsPublished(true);
        router.push(`/fixture?week=${weekId}`);
        router.refresh();
      } catch (err) {
        setPublishError(
          err instanceof Error ? err.message : "No se pudo publicar el fixture",
        );
      }
    });
  }

  const totalPairs = pairsM.length + pairsF.length;

  const fixtureMsg = buildFixtureMessage(
    weekLabel,
    pairsM.map((p) => ({ player1Name: p.p1Name, player2Name: p.p2Name })),
    pairsF.map((p) => ({ player1Name: p.p1Name, player2Name: p.p2Name })),
  );

  return (
    <div className="space-y-6">
      <CategoryEditor
        category="M"
        label="Hombres"
        allActivePlayers={allActivePlayersM}
        pairs={pairsM}
        setPairs={setPairsM}
        weekId={weekId}
        isPending={isPending}
        startTransition={startTransition}
      />

      <CategoryEditor
        category="F"
        label="Mujeres"
        allActivePlayers={allActivePlayersF}
        pairs={pairsF}
        setPairs={setPairsF}
        weekId={weekId}
        isPending={isPending}
        startTransition={startTransition}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Salida
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Publicar cruces
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {totalPairs} partido{totalPairs !== 1 ? "s" : ""} en total
              {isPublished
                ? " · Ya publicado — republicar actualiza los cruces"
                : ""}
            </p>
          </div>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isPending || totalPairs === 0}
            className="gap-2"
          >
            <Send />
            {isPending ? "Publicando" : isPublished ? "Republicar" : "Publicar"}
          </Button>
        </div>

        {publishError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{publishError}</span>
          </div>
        )}

        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Copy className="size-4" />
              Mensaje para WhatsApp
            </p>
            <CopyButton text={fixtureMsg} />
          </div>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
            {fixtureMsg}
          </pre>
        </div>
      </section>
    </div>
  );
}
