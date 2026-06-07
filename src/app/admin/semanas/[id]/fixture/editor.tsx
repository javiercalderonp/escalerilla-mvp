"use client";

import {
  AlertTriangle,
  Copy,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PairHistoryForPlayers,
  PairHistorySummary,
} from "@/lib/fixture/head-to-head";
import { buildFixtureMessage } from "@/lib/fixture/message";
import { normalizeSearchText } from "@/lib/utils";
import { type AddablePlayer, AddPlayersDialog } from "../add-players-dialog";
import { RemoveWeekPlayerButton } from "../remove-week-player-button";
import { WeekPlayerMatchLimitControls } from "../week-player-match-limit-controls";
import type { SerializedPair } from "./actions";
import { generateProposalAction, publishFixtureAction } from "./actions";

type ActivePlayer = {
  id: string;
  fullName: string;
  maxMatches: number;
  rankingPosition: number | null;
  recentResults: Array<"W" | "L" | "E">;
};

type DraftPair = SerializedPair & {
  draftId: string;
};

type PairField = "p1" | "p2";

type FixtureCategory = "M" | "F";

type PlayerSlot = {
  pairIndex: number;
  field: PairField;
};

type DragPayload =
  | {
      type: "slot";
      slot: PlayerSlot;
    }
  | {
      type: "bench";
      playerId: string;
    };

interface Props {
  weekId: string;
  weekLabel: string;
  allActivePlayersM: ActivePlayer[];
  allActivePlayersF: ActivePlayer[];
  initialPairsM: SerializedPair[];
  initialPairsF: SerializedPair[];
  pairHistoriesByPair: Record<string, PairHistorySummary>;
  hasPublishedMatches: boolean;
  addablePlayers: AddablePlayer[];
  addableMen: AddablePlayer[];
  addableWomen: AddablePlayer[];
  defaultAddPlayersOpen: boolean;
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

function MatchFormDots({
  results,
}: {
  results: ActivePlayer["recentResults"];
}) {
  if (results.length === 0) return null;

  const styles = {
    W: "bg-grass text-grass-foreground",
    L: "bg-red-600 text-white",
    E: "bg-slate-400 text-white",
  };

  return (
    <ul
      className="mt-2 flex items-center gap-1.5"
      aria-label="Últimos partidos"
    >
      {results.map((result, index) => (
        <li
          key={`${result}-${results.slice(0, index + 1).join("")}`}
          className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${styles[result]}`}
          title={
            result === "W" ? "Ganado" : result === "L" ? "Perdido" : "Empatado"
          }
        >
          {result}
        </li>
      ))}
    </ul>
  );
}

function ChangePlayerDialog({
  players,
  selectedPlayerId,
  currentPlayerName,
  pairLabel,
  onSelectPlayer,
}: {
  players: ActivePlayer[];
  selectedPlayerId: string;
  currentPlayerName: string;
  pairLabel: string;
  onSelectPlayer: (playerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    if (!normalizedQuery) return players;

    return players.filter((player) =>
      normalizeSearchText(formatPlayerOption(player)).includes(normalizedQuery),
    );
  }, [players, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
    }
  }

  function handleSelectPlayer(playerId: string) {
    onSelectPlayer(playerId);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="mt-3 h-auto px-0 py-0 text-xs font-semibold text-grass hover:bg-transparent hover:text-grass/80"
      >
        Cambiar jugador
      </Button>

      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar jugador</DialogTitle>
          <DialogDescription>
            {pairLabel} · Actual: {currentPlayerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar jugador"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-grass"
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            {filteredPlayers.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No hay jugadores con ese nombre.
              </p>
            ) : (
              filteredPlayers.map((player) => {
                const isSelected = player.id === selectedPlayerId;

                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelectPlayer(player.id)}
                    disabled={isSelected}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 ${
                      isSelected
                        ? "bg-slate-50 text-slate-400"
                        : "text-slate-800 hover:bg-grass/10"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">
                        {formatPlayerOption(player)}
                      </span>
                      <MatchFormDots results={player.recentResults} />
                    </span>
                    {isSelected && (
                      <span className="text-xs font-medium">Actual</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getRankDiff(playerA?: ActivePlayer, playerB?: ActivePlayer) {
  if (!playerA?.rankingPosition || !playerB?.rankingPosition) return null;
  return Math.abs(playerA.rankingPosition - playerB.rankingPosition);
}

function getPairKey(player1Id: string, player2Id: string) {
  return [player1Id, player2Id].sort().join(":");
}

function getPairHistoryForPlayers(
  historiesByPair: Record<string, PairHistorySummary>,
  player1Id: string,
  player2Id: string,
): PairHistoryForPlayers {
  const history = historiesByPair[getPairKey(player1Id, player2Id)];

  return {
    p1Wins: history?.winsByPlayer[player1Id] ?? 0,
    p2Wins: history?.winsByPlayer[player2Id] ?? 0,
    draws: history?.draws ?? 0,
    totalMatches: history?.totalMatches ?? 0,
    lastPlayedOn: history?.lastMatch?.playedOn ?? null,
    lastStatus: history?.lastMatch?.status ?? null,
    lastWinnerId: history?.lastMatch?.winnerId ?? null,
    lastScore: history?.lastMatch?.score ?? null,
  };
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function formatLastMatch(
  history: PairHistoryForPlayers,
  player1Id: string,
  player1Name: string,
  player2Id: string,
  player2Name: string,
) {
  if (!history.lastPlayedOn) return "Nunca se han enfrentado";
  if (history.lastStatus === "empate") {
    return `Última vez: ${formatDate(history.lastPlayedOn)} · empate`;
  }

  if (history.lastWinnerId) {
    const winnerName =
      history.lastWinnerId === player1Id
        ? player1Name
        : history.lastWinnerId === player2Id
          ? player2Name
          : null;

    return `Última vez: ${formatDate(history.lastPlayedOn)} · ganó ${
      winnerName ?? "sin dato"
    }${history.lastStatus === "wo" ? " por W.O." : ""}`;
  }

  return `Última vez: ${formatDate(history.lastPlayedOn)}`;
}

function canMakeChallenge(playerA?: ActivePlayer, playerB?: ActivePlayer) {
  const diff = getRankDiff(playerA, playerB);
  return diff !== null && diff <= 5;
}

function getSlotKey(slot: PlayerSlot) {
  return `${slot.pairIndex}:${slot.field}`;
}

function getSlotPlayerId(pair: DraftPair, field: PairField) {
  return field === "p1" ? pair.p1Id : pair.p2Id;
}

function getSlotPlayerName(pair: DraftPair, field: PairField) {
  return field === "p1" ? pair.p1Name : pair.p2Name;
}

function assignSlotPlayer(
  pair: DraftPair,
  field: PairField,
  player: { id: string; fullName: string },
) {
  if (field === "p1") {
    pair.p1Id = player.id;
    pair.p1Name = player.fullName;
  } else {
    pair.p2Id = player.id;
    pair.p2Name = player.fullName;
  }
}

function getPlayerUsage(pairs: DraftPair[]) {
  const playerUsage = new Map<string, number>();
  for (const pair of pairs) {
    playerUsage.set(pair.p1Id, (playerUsage.get(pair.p1Id) ?? 0) + 1);
    playerUsage.set(pair.p2Id, (playerUsage.get(pair.p2Id) ?? 0) + 1);
  }
  return playerUsage;
}

function getRemainingPlayers(players: ActivePlayer[], pairs: DraftPair[]) {
  const playerUsage = getPlayerUsage(pairs);
  return players
    .filter(
      (player) =>
        player.maxMatches > 0 &&
        (playerUsage.get(player.id) ?? 0) < player.maxMatches,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function setDragPayload(event: React.DragEvent, payload: DragPayload) {
  const serializedPayload = JSON.stringify(payload);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/json", serializedPayload);
  event.dataTransfer.setData("text/plain", serializedPayload);
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
  pairHistoriesByPair,
}: {
  category: "M" | "F";
  label: string;
  allActivePlayers: ActivePlayer[];
  pairs: DraftPair[];
  setPairs: React.Dispatch<React.SetStateAction<DraftPair[]>>;
  weekId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
  pairHistoriesByPair: Record<string, PairHistorySummary>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [draggingSlotKey, setDraggingSlotKey] = useState<string | null>(null);
  const [dropTargetSlotKey, setDropTargetSlotKey] = useState<string | null>(
    null,
  );
  const playersById = new Map(
    allActivePlayers.map((player) => [player.id, player]),
  );
  const availablePlayers = allActivePlayers.filter(
    (player) => player.maxMatches > 0,
  );

  const remainingPlayers = getRemainingPlayers(allActivePlayers, pairs);

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
    const currentPair = pairs[index];
    const opponentId = field === "p1" ? currentPair?.p2Id : currentPair?.p1Id;
    if (opponentId === player.id) {
      setError("Un partido no puede tener el mismo jugador dos veces");
      return;
    }
    setError(null);
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
      pair.history = getPairHistoryForPlayers(
        pairHistoriesByPair,
        pair.p1Id,
        pair.p2Id,
      );
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

  function refreshPair(pair: DraftPair) {
    pair.history = getPairHistoryForPlayers(
      pairHistoriesByPair,
      pair.p1Id,
      pair.p2Id,
    );
    if (
      !canMakeChallenge(playersById.get(pair.p1Id), playersById.get(pair.p2Id))
    ) {
      pair.isChallenge = false;
    }
  }

  function swapPlayerSlots(source: PlayerSlot, target: PlayerSlot) {
    if (getSlotKey(source) === getSlotKey(target)) return;

    const sourcePair = pairs[source.pairIndex];
    const targetPair = pairs[target.pairIndex];
    if (!sourcePair || !targetPair) return;

    const sourcePlayer = {
      id: getSlotPlayerId(sourcePair, source.field),
      fullName: getSlotPlayerName(sourcePair, source.field),
    };
    const targetPlayer = {
      id: getSlotPlayerId(targetPair, target.field),
      fullName: getSlotPlayerName(targetPair, target.field),
    };

    const next = pairs.map((pair) => ({ ...pair }));
    assignSlotPlayer(next[source.pairIndex], source.field, targetPlayer);
    assignSlotPlayer(next[target.pairIndex], target.field, sourcePlayer);

    if (
      next[source.pairIndex].p1Id === next[source.pairIndex].p2Id ||
      next[target.pairIndex].p1Id === next[target.pairIndex].p2Id
    ) {
      setError("Un partido no puede tener el mismo jugador dos veces");
      return;
    }

    setError(null);
    refreshPair(next[source.pairIndex]);
    if (source.pairIndex !== target.pairIndex) {
      refreshPair(next[target.pairIndex]);
    }
    setPairs(next);
  }

  function handlePlayerDragStart(event: React.DragEvent, source: PlayerSlot) {
    setDragPayload(event, { type: "slot", slot: source });
    setDraggingSlotKey(getSlotKey(source));
  }

  function handlePlayerDrop(event: React.DragEvent, target: PlayerSlot) {
    event.preventDefault();
    const payload =
      event.dataTransfer.getData("application/json") ||
      event.dataTransfer.getData("text/plain");
    setDropTargetSlotKey(null);
    setDraggingSlotKey(null);

    try {
      const parsedPayload = JSON.parse(payload) as DragPayload;
      if (parsedPayload.type === "slot") {
        const { slot: source } = parsedPayload;
        if (
          typeof source.pairIndex !== "number" ||
          (source.field !== "p1" && source.field !== "p2")
        ) {
          return;
        }
        swapPlayerSlots(source, target);
        return;
      }

      if (parsedPayload.type === "bench") {
        updatePair(target.pairIndex, target.field, parsedPayload.playerId);
      }
    } catch {
      return;
    }
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
        history: getPairHistoryForPlayers(
          pairHistoriesByPair,
          candidates[0].id,
          candidates[1].id,
        ),
        draftId: crypto.randomUUID(),
      },
    ]);
  }

  return (
    <section className="overflow-hidden rounded-lg border border-court/10 bg-card shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-grass">
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
            <div className="rounded-lg border border-dashed border-clay/30 bg-accent/30 px-6 py-8 text-center text-sm text-slate-600">
              No hay partidos. Regenera la propuesta o agrega uno manual.
            </div>
          ) : (
            pairs.map((pair, index) => {
              const p1 = playersById.get(pair.p1Id);
              const p2 = playersById.get(pair.p2Id);
              const rankDiff = getRankDiff(p1, p2);
              const challengeEnabled = canMakeChallenge(p1, p2);
              const history =
                pair.history ??
                getPairHistoryForPlayers(
                  pairHistoriesByPair,
                  pair.p1Id,
                  pair.p2Id,
                );
              const renderPlayerCard = (field: PairField) => {
                const slot = { pairIndex: index, field };
                const slotKey = getSlotKey(slot);
                const player = field === "p1" ? p1 : p2;
                const name = getSlotPlayerName(pair, field);
                const isDragging = draggingSlotKey === slotKey;
                const isDropTarget = dropTargetSlotKey === slotKey;

                return (
                  <fieldset
                    key={field}
                    draggable
                    onDragStart={(event) => handlePlayerDragStart(event, slot)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetSlotKey(slotKey);
                    }}
                    onDragLeave={() => setDropTargetSlotKey(null)}
                    onDrop={(event) => handlePlayerDrop(event, slot)}
                    onDragEnd={() => {
                      setDraggingSlotKey(null);
                      setDropTargetSlotKey(null);
                    }}
                    className={`min-w-0 cursor-grab rounded-lg border bg-white p-3 shadow-sm transition active:cursor-grabbing ${
                      isDropTarget
                        ? "border-grass ring-2 ring-grass/15"
                        : "border-slate-200"
                    } ${isDragging ? "opacity-50" : ""}`}
                  >
                    <legend className="sr-only">
                      Arrastrar {name} para intercambiar jugador
                    </legend>
                    <div className="flex items-start gap-3">
                      <GripVertical
                        className="mt-0.5 size-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-clay">
                          {field === "p1" ? "Jugador 1" : "Jugador 2"}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                          {formatRanking(player?.rankingPosition ?? null)}{" "}
                          {name}
                        </p>
                        {player && (
                          <MatchFormDots results={player.recentResults} />
                        )}
                      </div>
                    </div>
                    <ChangePlayerDialog
                      players={allActivePlayers}
                      selectedPlayerId={getSlotPlayerId(pair, field)}
                      currentPlayerName={name}
                      pairLabel={`Partido ${index + 1} · ${
                        field === "p1" ? "Jugador 1" : "Jugador 2"
                      }`}
                      onSelectPlayer={(playerId) =>
                        updatePair(index, field, playerId)
                      }
                    />
                  </fieldset>
                );
              };

              return (
                <div
                  key={pair.draftId}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-grass">
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

                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
                    {renderPlayerCard("p1")}
                    <span className="flex items-center justify-center text-xs font-semibold uppercase text-clay">
                      vs
                    </span>
                    {renderPlayerCard("p2")}
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

                  <div className="mt-3 grid gap-2 rounded-lg border border-grass/15 bg-grass/5 p-3 text-xs text-slate-600 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatLastMatch(
                          history,
                          pair.p1Id,
                          pair.p1Name,
                          pair.p2Id,
                          pair.p2Name,
                        )}
                      </p>
                      {(history.lastScore || history.totalMatches === 0) && (
                        <p className="mt-1">
                          {history.lastScore ??
                            "Sin historial previo entre ellos."}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Historial: {pair.p1Name} {history.p1Wins} -{" "}
                        {history.p2Wins} {pair.p2Name}
                      </p>
                      {history.draws > 0 && (
                        <p className="mt-1">
                          {history.draws} empate{history.draws !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
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
      </div>
    </section>
  );
}

function RemainingWeekPlayers({
  weekId,
  allActivePlayersM,
  allActivePlayersF,
  pairsM,
  pairsF,
  addablePlayers,
  addableMen,
  addableWomen,
  defaultAddPlayersOpen,
}: {
  weekId: string;
  allActivePlayersM: ActivePlayer[];
  allActivePlayersF: ActivePlayer[];
  pairsM: DraftPair[];
  pairsF: DraftPair[];
  addablePlayers: AddablePlayer[];
  addableMen: AddablePlayer[];
  addableWomen: AddablePlayer[];
  defaultAddPlayersOpen: boolean;
}) {
  const remainingM = getRemainingPlayers(allActivePlayersM, pairsM);
  const remainingF = getRemainingPlayers(allActivePlayersF, pairsF);
  const totalSelected =
    allActivePlayersM.filter((player) => player.maxMatches > 0).length +
    allActivePlayersF.filter((player) => player.maxMatches > 0).length;
  const totalRemaining = remainingM.length + remainingF.length;

  function handleBenchDragStart(event: React.DragEvent, playerId: string) {
    setDragPayload(event, { type: "bench", playerId });
  }

  const renderPlayerList = (
    players: ActivePlayer[],
    label: string,
    addableCategoryPlayers: AddablePlayer[],
  ) => {
    if (players.length === 0) return null;

    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-clay">
            {label} · {players.length}
          </p>
          <AddPlayersDialog
            weekId={weekId}
            label={label}
            players={addableCategoryPlayers}
          />
        </div>
        <ul className="space-y-1">
          {players.map((player) => (
            <li
              key={player.id}
              draggable
              onDragStart={(event) => handleBenchDragStart(event, player.id)}
              className="flex cursor-grab items-center justify-between rounded-lg border border-grass/15 bg-grass/5 px-3 py-2 text-sm transition hover:border-grass/30 hover:bg-grass/10 active:cursor-grabbing"
            >
              <span className="font-medium text-slate-900">
                {player.fullName}
              </span>
              <div className="flex items-center gap-2">
                <WeekPlayerMatchLimitControls
                  weekId={weekId}
                  playerId={player.id}
                  playerName={player.fullName}
                  maxMatches={player.maxMatches}
                />
                <RemoveWeekPlayerButton
                  weekId={weekId}
                  playerId={player.id}
                  playerName={player.fullName}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <section className="overflow-hidden rounded-lg border border-court/10 bg-card shadow-sm">
      <div className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Jugadores de la semana
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {totalSelected === 0
                ? "Seleccioná los jugadores que participan esta semana."
                : totalRemaining === 0
                  ? "Todos los jugadores seleccionados ya están en cruces."
                  : `${totalRemaining} jugador${totalRemaining !== 1 ? "es" : ""} disponible${totalRemaining !== 1 ? "s" : ""} para arrastrar al sorteo.`}
            </p>
          </div>
          <AddPlayersDialog
            weekId={weekId}
            label="la semana"
            players={addablePlayers}
            defaultOpen={defaultAddPlayersOpen}
            triggerLabel="Agregar jugadores"
          />
        </div>

        {totalRemaining > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {renderPlayerList(remainingM, "Hombres", addableMen)}
            {renderPlayerList(remainingF, "Mujeres", addableWomen)}
          </div>
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
  pairHistoriesByPair,
  hasPublishedMatches,
  addablePlayers,
  addableMen,
  addableWomen,
  defaultAddPlayersOpen,
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
  const [activeCategory, setActiveCategory] = useState<FixtureCategory>("M");
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
        router.push("/fixture");
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
      <RemainingWeekPlayers
        weekId={weekId}
        allActivePlayersM={allActivePlayersM}
        allActivePlayersF={allActivePlayersF}
        pairsM={pairsM}
        pairsF={pairsF}
        addablePlayers={addablePlayers}
        addableMen={addableMen}
        addableWomen={addableWomen}
        defaultAddPlayersOpen={defaultAddPlayersOpen}
      />

      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl border border-court/10 bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveCategory("M")}
            className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
              activeCategory === "M"
                ? "bg-court text-court-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Hombres
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("F")}
            className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
              activeCategory === "F"
                ? "bg-court text-court-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Mujeres
          </button>
        </div>
      </div>

      {activeCategory === "M" ? (
        <CategoryEditor
          category="M"
          label="Hombres"
          allActivePlayers={allActivePlayersM}
          pairs={pairsM}
          setPairs={setPairsM}
          weekId={weekId}
          isPending={isPending}
          startTransition={startTransition}
          pairHistoriesByPair={pairHistoriesByPair}
        />
      ) : (
        <CategoryEditor
          category="F"
          label="Mujeres"
          allActivePlayers={allActivePlayersF}
          pairs={pairsF}
          setPairs={setPairsF}
          weekId={weekId}
          isPending={isPending}
          startTransition={startTransition}
          pairHistoriesByPair={pairHistoriesByPair}
        />
      )}

      <section className="overflow-hidden rounded-lg border border-court/10 bg-card p-5 shadow-sm">
        <div className="rounded-lg border border-grass/20 bg-grass/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-court">
              <Copy className="size-4" />
              Mensaje para WhatsApp
            </p>
            <CopyButton text={fixtureMsg} />
          </div>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-court">
            {fixtureMsg}
          </pre>
        </div>
      </section>

      {publishError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{publishError}</span>
        </div>
      )}

      <div className="flex justify-end">
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
    </div>
  );
}
