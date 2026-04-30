"use client";

import { useState, useTransition } from "react";

import { CopyButton } from "@/components/ui/copy-button";
import { buildFixtureMessage } from "@/lib/fixture/message";
import type { SerializedPair } from "./actions";
import { generateProposalAction, publishFixtureAction } from "./actions";

type ActivePlayer = {
  id: string;
  fullName: string;
  points: number;
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
  pairs: SerializedPair[];
  setPairs: React.Dispatch<React.SetStateAction<SerializedPair[]>>;
  recentOpponentMap: Record<string, string[]>;
  weekId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  function handleRegenerate() {
    startTransition(async () => {
      const result = await generateProposalAction(weekId, category);
      setPairs(result);
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
    if (allActivePlayers.length < 2) return;
    setPairs((prev) => [
      ...prev,
      {
        p1Id: allActivePlayers[0].id,
        p1Name: allActivePlayers[0].fullName,
        p2Id: allActivePlayers[1].id,
        p2Name: allActivePlayers[1].fullName,
      },
    ]);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{label}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {availableCount} disponibles · {pairs.length} partido
            {pairs.length !== 1 ? "s" : ""} propuesto
            {pairs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:opacity-50"
        >
          {isPending ? "Generando..." : "Regenerar propuesta"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {pairs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
            No hay partidos. Regenerá la propuesta o agregá uno manual.
          </div>
        ) : (
          pairs.map((pair, index) => {
            const violation = hasRn03Violation(
              pair.p1Id,
              pair.p2Id,
              recentOpponentMap,
            );
            return (
              <div
                key={`${pair.p1Id}-${pair.p2Id}`}
                className={`flex flex-wrap items-center gap-2 rounded-2xl border p-3 ${
                  violation
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200"
                }`}
              >
                <select
                  value={pair.p1Id}
                  onChange={(e) => updatePair(index, "p1", e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                >
                  {allActivePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.points} pts)
                    </option>
                  ))}
                </select>
                <span className="shrink-0 text-sm text-slate-400">vs</span>
                <select
                  value={pair.p2Id}
                  onChange={(e) => updatePair(index, "p2", e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                >
                  {allActivePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.points} pts)
                    </option>
                  ))}
                </select>
                {violation && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    ⚠ RN-03
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePair(index)}
                  className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  title="Eliminar partido"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {allActivePlayers.length >= 2 && (
        <button
          type="button"
          onClick={addPair}
          className="mt-3 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
        >
          + Agregar partido
        </button>
      )}
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
  const [pairsM, setPairsM] = useState<SerializedPair[]>(initialPairsM);
  const [pairsF, setPairsF] = useState<SerializedPair[]>(initialPairsF);
  const [isPublished, setIsPublished] = useState(hasPublishedMatches);
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    startTransition(async () => {
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Publicar fixture
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {totalPairs} partido{totalPairs !== 1 ? "s" : ""} en total
              {isPublished
                ? " · Ya publicado — republicar reemplaza los pendientes"
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPending || totalPairs === 0}
            className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending
              ? "Publicando..."
              : isPublished
                ? "Republicar fixture"
                : "Publicar fixture"}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Mensaje para WhatsApp
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-emerald-800">
            {fixtureMsg}
          </pre>
          <CopyButton text={fixtureMsg} />
        </div>
      </section>
    </div>
  );
}
