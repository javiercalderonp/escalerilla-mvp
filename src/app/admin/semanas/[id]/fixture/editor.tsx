"use client";

import {
  AlertTriangle,
  Copy,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { buildFixtureMessage } from "@/lib/fixture/message";
import type { SerializedPair } from "./actions";
import { generateProposalAction, publishFixtureAction } from "./actions";

type ActivePlayer = {
  id: string;
  fullName: string;
  points: number;
  maxMatches: number;
};

type DraftPair = SerializedPair & {
  draftId: string;
};

interface Props {
  weekId: string;
  weekLabel: string;
  allActivePlayersM: ActivePlayer[];
  allActivePlayersF: ActivePlayer[];
  availableCountM: number;
  availableCountF: number;
  recentOpponentMap: Record<string, string[]>;
  initialPairsM: SerializedPair[];
  initialPairsF: SerializedPair[];
  hasPublishedMatches: boolean;
}

function hasRn03Violation(
  p1Id: string,
  p2Id: string,
  recentOpponentMap: Record<string, string[]>,
): boolean {
  return (
    recentOpponentMap[p1Id]?.includes(p2Id) ||
    recentOpponentMap[p2Id]?.includes(p1Id) ||
    false
  );
}

function getPairKey(p1Id: string, p2Id: string) {
  return [p1Id, p2Id].sort().join(":");
}

function withDraftId(pair: SerializedPair): DraftPair {
  return { ...pair, draftId: crypto.randomUUID() };
}

function formatPlayerOption(player: ActivePlayer) {
  const status =
    player.maxMatches > 0 ? `${player.maxMatches} cupo` : "sin cupo";
  return `${player.fullName} (${player.points} pts · ${status}${
    player.maxMatches === 1 ? "" : "s"
  })`;
}

function CategoryEditor({
  category,
  label,
  allActivePlayers,
  availableCount,
  pairs,
  setPairs,
  recentOpponentMap,
  weekId,
  isPending,
  startTransition,
}: {
  category: "M" | "F";
  label: string;
  allActivePlayers: ActivePlayer[];
  availableCount: number;
  pairs: DraftPair[];
  setPairs: React.Dispatch<React.SetStateAction<DraftPair[]>>;
  recentOpponentMap: Record<string, string[]>;
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
  const pairUsage = new Map<string, number>();
  for (const pair of pairs) {
    playerUsage.set(pair.p1Id, (playerUsage.get(pair.p1Id) ?? 0) + 1);
    playerUsage.set(pair.p2Id, (playerUsage.get(pair.p2Id) ?? 0) + 1);
    const pairKey = getPairKey(pair.p1Id, pair.p2Id);
    pairUsage.set(pairKey, (pairUsage.get(pairKey) ?? 0) + 1);
  }

  const remainingPlayers = availablePlayers.filter(
    (player) => (playerUsage.get(player.id) ?? 0) < player.maxMatches,
  );
  const capacity = availablePlayers.reduce(
    (sum, player) => sum + player.maxMatches,
    0,
  );
  const usedSlots = pairs.length * 2;
  const warningCount = pairs.reduce((count, pair) => {
    const p1 = playersById.get(pair.p1Id);
    const p2 = playersById.get(pair.p2Id);
    const hasViolation = hasRn03Violation(
      pair.p1Id,
      pair.p2Id,
      recentOpponentMap,
    );
    const hasDuplicate =
      (pairUsage.get(getPairKey(pair.p1Id, pair.p2Id)) ?? 0) > 1;
    const hasSamePlayer = pair.p1Id === pair.p2Id;
    const hasExceeded =
      (playerUsage.get(pair.p1Id) ?? 0) > (p1?.maxMatches ?? 0) ||
      (playerUsage.get(pair.p2Id) ?? 0) > (p2?.maxMatches ?? 0);
    const hasUnavailable =
      (p1?.maxMatches ?? 0) <= 0 || (p2?.maxMatches ?? 0) <= 0;

    return (
      count +
      (hasViolation ||
      hasDuplicate ||
      hasSamePlayer ||
      hasExceeded ||
      hasUnavailable
        ? 1
        : 0)
    );
  }, 0);

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
          {isPending ? "Generando" : "Regenerar"}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Disponibles</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {availableCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Cupos usados</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {usedSlots}/{capacity}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Partidos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {pairs.length}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            warningCount > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p className="text-xs font-medium text-slate-600">Alertas</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              warningCount > 0 ? "text-amber-800" : "text-emerald-800"
            }`}
          >
            {warningCount}
          </p>
        </div>
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
            const pointsDelta = Math.abs((p1?.points ?? 0) - (p2?.points ?? 0));
            const violation = hasRn03Violation(
              pair.p1Id,
              pair.p2Id,
              recentOpponentMap,
            );
            const duplicatePair =
              (pairUsage.get(getPairKey(pair.p1Id, pair.p2Id)) ?? 0) > 1;
            const samePlayer = pair.p1Id === pair.p2Id;
            const exceededCapacity =
              (playerUsage.get(pair.p1Id) ?? 0) > (p1?.maxMatches ?? 0) ||
              (playerUsage.get(pair.p2Id) ?? 0) > (p2?.maxMatches ?? 0);
            const unavailable =
              (p1?.maxMatches ?? 0) <= 0 || (p2?.maxMatches ?? 0) <= 0;
            const hasWarning =
              violation ||
              duplicatePair ||
              samePlayer ||
              exceededCapacity ||
              unavailable;
            return (
              <div
                key={pair.draftId}
                className={`rounded-lg border p-4 ${
                  hasWarning
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Partido {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {pair.p1Name} vs {pair.p2Name}
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

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    Delta {pointsDelta} pts
                  </span>
                  {violation && (
                    <span className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-800">
                      RN-03
                    </span>
                  )}
                  {duplicatePair && (
                    <span className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-800">
                      Repetido
                    </span>
                  )}
                  {samePlayer && (
                    <span className="rounded-md bg-red-100 px-2 py-1 font-medium text-red-800">
                      Mismo jugador
                    </span>
                  )}
                  {exceededCapacity && (
                    <span className="rounded-md bg-red-100 px-2 py-1 font-medium text-red-800">
                      Cupo excedido
                    </span>
                  )}
                  {unavailable && (
                    <span className="rounded-md bg-red-100 px-2 py-1 font-medium text-red-800">
                      Sin disponibilidad
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="min-w-0 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <Users className="size-4" />
            Sin pareja o cupo restante
          </div>
          <p className="mt-1">
            {remainingPlayers.length > 0
              ? remainingPlayers.map((player) => player.fullName).join(", ")
              : "Todos los cupos disponibles están usados."}
          </p>
        </div>
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
  availableCountM,
  availableCountF,
  recentOpponentMap,
  initialPairsM,
  initialPairsF,
  hasPublishedMatches,
}: Props) {
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
          })),
          ...pairsF.map((p) => ({
            player1Id: p.p1Id,
            player2Id: p.p2Id,
            category: "F" as const,
          })),
        ];
        await publishFixtureAction(weekId, allPairs);
        setIsPublished(true);
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
        availableCount={availableCountM}
        pairs={pairsM}
        setPairs={setPairsM}
        recentOpponentMap={recentOpponentMap}
        weekId={weekId}
        isPending={isPending}
        startTransition={startTransition}
      />

      <CategoryEditor
        category="F"
        label="Mujeres"
        allActivePlayers={allActivePlayersF}
        availableCount={availableCountF}
        pairs={pairsF}
        setPairs={setPairsF}
        recentOpponentMap={recentOpponentMap}
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
              Publicar programación
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {totalPairs} partido{totalPairs !== 1 ? "s" : ""} en total
              {isPublished
                ? " · Ya publicado: republicar actualiza la programación"
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
