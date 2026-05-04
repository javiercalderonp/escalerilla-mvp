"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { playerReportResultAction } from "./actions";
import type { ParsedSet } from "./actions";

export type PendingMatch = {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  type: "sorteo" | "desafio" | "campeonato";
};

export type PlayerOption = { id: string; fullName: string };

type MatchFormat = "mr3" | "set_largo" | "wo" | "empate";

type Props = {
  pendingMatches: PendingMatch[];
  allPlayers: PlayerOption[];
  myPlayerId: string;
  myName: string;
};

function SetScoreFields({
  label,
  vp1,
  onP1Change,
  vp2,
  onP2Change,
  vtbp1,
  onTbP1Change,
  vtbp2,
  onTbP2Change,
  showTiebreak,
}: {
  label: string;
  vp1: string;
  onP1Change: (v: string) => void;
  vp2: string;
  onP2Change: (v: string) => void;
  vtbp1: string;
  onTbP1Change: (v: string) => void;
  vtbp2: string;
  onTbP2Change: (v: string) => void;
  showTiebreak: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          min={0}
          value={vp1}
          onChange={(e) => onP1Change(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
          placeholder="0"
        />
        <input
          type="number"
          min={0}
          value={vp2}
          onChange={(e) => onP2Change(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
          placeholder="0"
        />
      </div>
      {showTiebreak && (
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            min={0}
            value={vtbp1}
            onChange={(e) => onTbP1Change(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-500 focus:border-slate-400 focus:outline-none"
            placeholder="TB (si aplica)"
          />
          <input
            type="number"
            min={0}
            value={vtbp2}
            onChange={(e) => onTbP2Change(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-500 focus:border-slate-400 focus:outline-none"
            placeholder="TB (si aplica)"
          />
        </div>
      )}
    </div>
  );
}

export function ResultForm({
  pendingMatches,
  allPlayers,
  myPlayerId,
  myName,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [matchSelection, setMatchSelection] = useState<string | "new" | null>(
    null,
  );
  const [opponentId, setOpponentId] = useState("");
  const [isChallenge, setIsChallenge] = useState(false);

  // Step 2
  const [format, setFormat] = useState<MatchFormat | null>(null);
  const [playedOn, setPlayedOn] = useState("");
  const [s1p1, setS1p1] = useState("");
  const [s1p2, setS1p2] = useState("");
  const [s1tbp1, setS1tbp1] = useState("");
  const [s1tbp2, setS1tbp2] = useState("");
  const [s2p1, setS2p1] = useState("");
  const [s2p2, setS2p2] = useState("");
  const [s2tbp1, setS2tbp1] = useState("");
  const [s2tbp2, setS2tbp2] = useState("");
  const [hasSet3, setHasSet3] = useState(false);
  const [s3p1, setS3p1] = useState("");
  const [s3p2, setS3p2] = useState("");
  const [woWinnerId, setWoWinnerId] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const currentMatch =
    matchSelection === "new"
      ? null
      : pendingMatches.find((m) => m.id === matchSelection);

  const p1Id = currentMatch?.player1Id ?? myPlayerId;
  const p2Id = currentMatch?.player2Id ?? opponentId;
  const p1Name = currentMatch?.player1Name ?? myName;
  const p2Name =
    currentMatch?.player2Name ??
    allPlayers.find((p) => p.id === opponentId)?.fullName ??
    "Rival";

  function handleFormatChange(f: MatchFormat) {
    setFormat(f);
    setS1p1("");
    setS1p2("");
    setS1tbp1("");
    setS1tbp2("");
    setS2p1("");
    setS2p2("");
    setS2tbp1("");
    setS2tbp2("");
    setS3p1("");
    setS3p2("");
    setHasSet3(false);
    setWoWinnerId("");
    setError(null);
  }

  function resetAll() {
    setStep(1);
    setMatchSelection(null);
    setOpponentId("");
    setIsChallenge(false);
    setFormat(null);
    setPlayedOn("");
    setS1p1("");
    setS1p2("");
    setS1tbp1("");
    setS1tbp2("");
    setS2p1("");
    setS2p2("");
    setS2tbp1("");
    setS2tbp2("");
    setS3p1("");
    setS3p2("");
    setHasSet3(false);
    setWoWinnerId("");
    setError(null);
    setDone(false);
  }

  function handleSubmit() {
    setError(null);

    if (!format) {
      setError("Selecciona el formato del partido");
      return;
    }

    if (format === "wo" && !woWinnerId) {
      setError("Indica quién ganó el W.O.");
      return;
    }

    let sets: ParsedSet[] | undefined;

    if (format !== "wo") {
      const g1p1 = parseInt(s1p1);
      const g1p2 = parseInt(s1p2);
      if (isNaN(g1p1) || isNaN(g1p2)) {
        setError("Completa el puntaje del Set 1");
        return;
      }

      sets = [
        {
          setNumber: 1,
          gamesP1: g1p1,
          gamesP2: g1p2,
          tiebreakP1: s1tbp1 ? parseInt(s1tbp1) : null,
          tiebreakP2: s1tbp2 ? parseInt(s1tbp2) : null,
        },
      ];

      if (format !== "set_largo") {
        const g2p1 = parseInt(s2p1);
        const g2p2 = parseInt(s2p2);
        if (isNaN(g2p1) || isNaN(g2p2)) {
          setError("Completa el puntaje del Set 2");
          return;
        }
        sets.push({
          setNumber: 2,
          gamesP1: g2p1,
          gamesP2: g2p2,
          tiebreakP1: s2tbp1 ? parseInt(s2tbp1) : null,
          tiebreakP2: s2tbp2 ? parseInt(s2tbp2) : null,
        });

        if (hasSet3) {
          const g3p1 = parseInt(s3p1);
          const g3p2 = parseInt(s3p2);
          if (!isNaN(g3p1) && !isNaN(g3p2)) {
            sets.push({ setNumber: 3, gamesP1: g3p1, gamesP2: g3p2 });
          }
        }
      }
    }

    const base = {
      format,
      playedOn: playedOn || undefined,
      sets,
      woWinnerId: format === "wo" ? woWinnerId : undefined,
    };

    const actionInput =
      matchSelection === "new"
        ? ({ kind: "unscheduled", opponentId, isChallenge, ...base } as const)
        : ({
            kind: "scheduled",
            matchId: matchSelection!,
            ...base,
          } as const);

    startTransition(async () => {
      const result = await playerReportResultAction(actionInput);
      if ("error" in result) {
        setError(result.error);
      } else {
        setDone(true);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
        <h2 className="mb-1 text-lg font-semibold text-emerald-800">
          ¡Resultado ingresado!
        </h2>
        <p className="mb-6 text-sm text-emerald-600">
          Los puntos se han actualizado en la tabla.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/fixture"
            className="rounded-xl bg-[#0d1b2a] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0d1b2a]/80"
          >
            Ver resultados
          </Link>
          <button
            onClick={resetAll}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Ingresar otro resultado
          </button>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ¿Cuál fue tu partido?
          </p>

          <div className="space-y-2">
            {pendingMatches.length === 0 && (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No tienes partidos pendientes esta semana.
              </p>
            )}

            {pendingMatches.map((m) => {
              const opponentName =
                m.player1Id === myPlayerId ? m.player2Name : m.player1Name;
              const isSelected = matchSelection === m.id;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMatchSelection(m.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-clay bg-clay/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      vs {opponentName}
                    </span>
                    {m.type === "desafio" && (
                      <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                        Desafío
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setMatchSelection("new")}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                matchSelection === "new"
                  ? "border-clay bg-clay/5"
                  : "border-dashed border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <span className="text-sm font-medium text-slate-700">
                Mi partido no estaba programado
              </span>
              <p className="mt-0.5 text-xs text-slate-500">
                Elige tu rival manualmente
              </p>
            </button>
          </div>

          {matchSelection === "new" && (
            <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Rival
                </label>
                <select
                  value={opponentId}
                  onChange={(e) => setOpponentId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
                >
                  <option value="">Selecciona un jugador</option>
                  {allPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isChallenge}
                  onChange={(e) => setIsChallenge(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-clay"
                />
                <span className="text-sm text-slate-700">
                  Fue un desafío
                </span>
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep(2);
          }}
          disabled={
            matchSelection === null ||
            (matchSelection === "new" && !opponentId)
          }
          className="w-full rounded-xl bg-[#0d1b2a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0d1b2a]/80 disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    );
  }

  // Step 2: result entry
  const matchLabel =
    currentMatch?.type === "desafio"
      ? `${p1Name} vs ${p2Name} · Desafío`
      : `${p1Name} vs ${p2Name}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setFormat(null);
            setError(null);
            setStep(1);
          }}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Volver
        </button>
        <div className="flex-1 truncate rounded-xl bg-[#0d1b2a] px-3 py-2 text-center text-xs font-medium text-white">
          {matchLabel}
        </div>
      </div>

      {/* Format */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Formato
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "mr3", label: "Mejor de 3" },
              { key: "set_largo", label: "Set Largo" },
              { key: "wo", label: "W.O." },
              { key: "empate", label: "Empate (1-1)" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleFormatChange(key)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                format === key
                  ? "border-clay bg-clay text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Score fields */}
      {format && format !== "wo" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 px-0.5">
            <span className="truncate text-xs font-semibold text-slate-700">
              {p1Name}
            </span>
            <span className="truncate text-xs font-semibold text-slate-700">
              {p2Name}
            </span>
          </div>

          <SetScoreFields
            label="Set 1"
            vp1={s1p1}
            onP1Change={setS1p1}
            vp2={s1p2}
            onP2Change={setS1p2}
            vtbp1={s1tbp1}
            onTbP1Change={setS1tbp1}
            vtbp2={s1tbp2}
            onTbP2Change={setS1tbp2}
            showTiebreak={format !== "empate"}
          />

          {format !== "set_largo" && (
            <SetScoreFields
              label="Set 2"
              vp1={s2p1}
              onP1Change={setS2p1}
              vp2={s2p2}
              onP2Change={setS2p2}
              vtbp1={s2tbp1}
              onTbP1Change={setS2tbp1}
              vtbp2={s2tbp2}
              onTbP2Change={setS2tbp2}
              showTiebreak={format !== "empate"}
            />
          )}

          {format === "mr3" && (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasSet3}
                  onChange={(e) => setHasSet3(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-clay"
                />
                <span className="text-sm text-slate-700">
                  Hubo 3er set (super tie-break)
                </span>
              </label>

              {hasSet3 && (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min={0}
                    value={s3p1}
                    onChange={(e) => setS3p1(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
                    placeholder="0"
                  />
                  <input
                    type="number"
                    min={0}
                    value={s3p2}
                    onChange={(e) => setS3p2(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* WO */}
      {format === "wo" && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ¿Quién ganó?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWoWinnerId(p1Id)}
              className={`rounded-xl border px-4 py-3 text-sm transition ${
                woWinnerId === p1Id
                  ? "border-clay bg-clay/10 font-semibold text-clay"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-medium">{p1Name}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                ({p2Name} no se presentó)
              </div>
            </button>
            <button
              type="button"
              onClick={() => setWoWinnerId(p2Id)}
              className={`rounded-xl border px-4 py-3 text-sm transition ${
                woWinnerId === p2Id
                  ? "border-clay bg-clay/10 font-semibold text-clay"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-medium">{p2Name}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                ({p1Name} no se presentó)
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Fecha del partido{" "}
          <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <input
          type="date"
          value={playedOn}
          onChange={(e) => setPlayedOn(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !format}
        className="w-full rounded-xl bg-clay px-6 py-3 text-sm font-semibold text-white transition hover:bg-clay/90 disabled:opacity-40"
      >
        {isPending ? "Guardando..." : "Reportar resultado"}
      </button>
    </div>
  );
}
