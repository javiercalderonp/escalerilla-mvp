"use client";

import { ArrowLeft, Check, Info } from "lucide-react";
import Link from "next/link";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { getTodayInSantiago } from "@/lib/date";

import type { ParsedSet } from "./actions";
import { playerReportResultAction } from "./actions";

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

const WHEEL_ITEM_HEIGHT = 40;

function buildSetFromDisplayOrder({
  setNumber,
  playerGames,
  opponentGames,
  shouldSwap,
}: {
  setNumber: number;
  playerGames: number;
  opponentGames: number;
  shouldSwap: boolean;
}): ParsedSet {
  return {
    setNumber,
    gamesP1: shouldSwap ? opponentGames : playerGames,
    gamesP2: shouldSwap ? playerGames : opponentGames,
  };
}

function ScoreWheel({
  value,
  onChange,
  max,
  ariaLabel,
  optional = false,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  ariaLabel: string;
  optional?: boolean;
  compact?: boolean;
}) {
  const wheelId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const values = useMemo(
    () => [
      ...(optional ? [""] : []),
      ...Array.from({ length: max + 1 }, (_, index) => String(index)),
    ],
    [max, optional],
  );
  const selectedIndex = Math.max(0, values.indexOf(value));

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: selectedIndex * WHEEL_ITEM_HEIGHT,
      behavior: "smooth",
    });
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  function commitScrollPosition(shouldSnap: boolean) {
    const node = scrollRef.current;
    if (!node) return;

    const nextIndex = Math.min(
      values.length - 1,
      Math.max(0, Math.round(node.scrollTop / WHEEL_ITEM_HEIGHT)),
    );
    const nextValue = values[nextIndex] ?? "";

    if (nextValue !== value) onChange(nextValue);

    if (shouldSnap) {
      node.scrollTo({
        top: nextIndex * WHEEL_ITEM_HEIGHT,
        behavior: "smooth",
      });
    }
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-300 bg-white text-center focus-within:border-clay focus-within:ring-1 focus-within:ring-clay ${
        compact ? "h-20" : "h-28"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 rounded-lg bg-clay/10 ring-1 ring-clay/20 ${
          compact ? "h-9" : "h-10"
        }`}
      />
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`${wheelId}-${selectedIndex}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = Math.min(
            values.length - 1,
            Math.max(0, selectedIndex + direction),
          );
          onChange(values[nextIndex] ?? "");
        }}
        onScroll={() => {
          commitScrollPosition(false);
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          scrollTimeoutRef.current = setTimeout(() => {
            commitScrollPosition(true);
          }, 90);
        }}
        className={`h-full snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          compact ? "py-5" : "py-9"
        }`}
      >
        {values.map((option, index) => {
          const isSelected = index === selectedIndex;

          return (
            <button
              id={`${wheelId}-${index}`}
              key={option || "empty"}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onChange(option)}
              className={`relative z-20 flex h-10 w-full snap-center items-center justify-center font-semibold transition ${
                isSelected ? "text-clay" : "text-slate-400 hover:text-slate-600"
              } ${compact ? "text-base" : "text-lg"}`}
            >
              {option || "-"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoreNumberInput({
  value,
  onChange,
  max,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (nextValue === "") {
          onChange("");
          return;
        }
        if (!/^\d+$/.test(nextValue)) return;

        const nextScore = Math.min(max, Math.max(0, Number(nextValue)));
        onChange(String(nextScore));
      }}
      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-lg font-semibold text-slate-900 outline-none transition focus:border-clay focus:ring-1 focus:ring-clay"
    />
  );
}

function ScoreControl({
  value,
  onChange,
  max,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  ariaLabel: string;
}) {
  return (
    <>
      <div className="md:hidden">
        <ScoreWheel
          value={value}
          onChange={onChange}
          max={max}
          ariaLabel={ariaLabel}
        />
      </div>
      <div className="hidden md:block">
        <ScoreNumberInput
          value={value}
          onChange={onChange}
          max={max}
          ariaLabel={ariaLabel}
        />
      </div>
    </>
  );
}

function SetScoreFields({
  label,
  vp1,
  onP1Change,
  vp2,
  onP2Change,
  maxGames,
}: {
  label: string;
  vp1: string;
  onP1Change: (v: string) => void;
  vp2: string;
  onP2Change: (v: string) => void;
  maxGames: number;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <ScoreControl
          value={vp1}
          onChange={onP1Change}
          max={maxGames}
          ariaLabel={`${label} jugador 1`}
        />
        <ScoreControl
          value={vp2}
          onChange={onP2Change}
          max={maxGames}
          ariaLabel={`${label} jugador 2`}
        />
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { num: 1 as const, label: "Reportar" },
    { num: 2 as const, label: "Revisar" },
    { num: 3 as const, label: "Enviado" },
  ];
  return (
    <div className="mb-4 flex items-center justify-center">
      {steps.map((s, i) => (
        <Fragment key={s.num}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                s.num === current
                  ? "bg-clay text-white"
                  : s.num < current
                    ? "bg-clay/20 text-clay"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.num < current ? <Check className="h-4 w-4" /> : s.num}
            </div>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                s.num === current ? "text-clay" : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < 2 && (
            <div
              className={`mb-4 h-px w-10 ${
                s.num < current ? "bg-clay/40" : "bg-slate-200"
              }`}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function PlayerCard({
  name,
  isWinner,
  isSelected,
  onClick,
  disabled,
}: {
  name: string;
  isWinner?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, disabled } : {})}
      className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 transition ${
        isSelected
          ? "border-clay bg-clay/5"
          : onClick
            ? "border-slate-200 bg-white hover:border-slate-300"
            : "border-transparent bg-transparent"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-bold ${
          isWinner ?? isSelected
            ? "bg-clay text-white"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {initials}
      </div>
      <span
        className={`text-center text-sm font-semibold leading-tight ${
          isSelected ? "text-clay" : "text-slate-700"
        }`}
      >
        {name}
      </span>
    </Tag>
  );
}

type Props = {
  pendingMatches: PendingMatch[];
  allPlayers: PlayerOption[];
  myPlayerId: string;
  myName: string;
  rankingHref: string;
};

export function ResultForm({
  pendingMatches,
  allPlayers,
  myPlayerId,
  myName,
  rankingHref,
}: Props) {
  const [uiStep, setUiStep] = useState<1 | 2 | 3>(1);
  const opponentSelectId = useId();
  const playedOnInputId = useId();

  const [matchSelection, setMatchSelection] = useState<string | "new" | null>(
    null,
  );
  const [opponentId, setOpponentId] = useState("");
  const [isChallenge, setIsChallenge] = useState(false);

  const [format, setFormat] = useState<MatchFormat | null>(null);
  const [playedOn, setPlayedOn] = useState(() => getTodayInSantiago());
  const [s1p1, setS1p1] = useState("");
  const [s1p2, setS1p2] = useState("");
  const [s2p1, setS2p1] = useState("");
  const [s2p2, setS2p2] = useState("");
  const [hasSet3, setHasSet3] = useState(false);
  const [s3p1, setS3p1] = useState("");
  const [s3p2, setS3p2] = useState("");
  const [woWinnerId, setWoWinnerId] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentMatch =
    matchSelection === "new"
      ? null
      : pendingMatches.find((m) => m.id === matchSelection);

  const currentMatchOpponentId =
    currentMatch?.player1Id === myPlayerId
      ? currentMatch.player2Id
      : currentMatch?.player1Id;
  const currentMatchOpponentName =
    currentMatch?.player1Id === myPlayerId
      ? currentMatch.player2Name
      : currentMatch?.player1Name;
  const displayPlayerId = myPlayerId;
  const displayOpponentId = currentMatchOpponentId ?? opponentId;
  const displayPlayerName = myName;
  const displayOpponentName =
    currentMatchOpponentName ??
    allPlayers.find((p) => p.id === opponentId)?.fullName ??
    "Rival";
  const shouldSwapScores = currentMatch?.player2Id === myPlayerId;

  const setsForReview = useMemo(() => {
    if (!format || format === "wo" || format === "empate") return [];
    const sets: { p1: string; p2: string }[] = [];
    if (s1p1 !== "" && s1p2 !== "") sets.push({ p1: s1p1, p2: s1p2 });
    if (format !== "set_largo" && s2p1 !== "" && s2p2 !== "")
      sets.push({ p1: s2p1, p2: s2p2 });
    if (hasSet3 && s3p1 !== "" && s3p2 !== "")
      sets.push({ p1: s3p1, p2: s3p2 });
    return sets;
  }, [format, s1p1, s1p2, s2p1, s2p2, s3p1, s3p2, hasSet3]);

  const setsWonP1 = setsForReview.filter(
    (s) => parseInt(s.p1) > parseInt(s.p2),
  ).length;
  const setsWonP2 = setsForReview.filter(
    (s) => parseInt(s.p2) > parseInt(s.p1),
  ).length;

  const derivedWinnerName =
    format === "wo"
      ? woWinnerId === displayPlayerId
        ? displayPlayerName
        : woWinnerId === displayOpponentId
          ? displayOpponentName
          : null
      : format === "empate"
        ? null
        : setsWonP1 > setsWonP2
          ? displayPlayerName
          : setsWonP2 > setsWonP1
            ? displayOpponentName
            : null;

  function handleFormatChange(f: MatchFormat) {
    setFormat(f);
    setS1p1("0");
    setS1p2("0");
    setS2p1("0");
    setS2p2("0");
    setS3p1("");
    setS3p2("");
    setHasSet3(false);
    setWoWinnerId("");
    setError(null);
  }

  function resetAll() {
    setUiStep(1);
    setMatchSelection(null);
    setOpponentId("");
    setIsChallenge(false);
    setFormat(null);
    setPlayedOn(getTodayInSantiago());
    setS1p1("");
    setS1p2("");
    setS2p1("");
    setS2p2("");
    setS3p1("");
    setS3p2("");
    setHasSet3(false);
    setWoWinnerId("");
    setError(null);
  }

  function validateAndGoToReview() {
    if (matchSelection === null) {
      setError("Selecciona un partido");
      return;
    }
    if (matchSelection === "new" && !opponentId) {
      setError("Selecciona un rival");
      return;
    }
    if (!format) {
      setError("Selecciona el formato del partido");
      return;
    }
    if (format === "wo" && !woWinnerId) {
      setError("Indica quién ganó el W.O.");
      return;
    }
    if (format !== "wo" && format !== "empate") {
      if (s1p1 === "" || s1p2 === "") {
        setError("Completa el puntaje del Set 1");
        return;
      }
      if (format !== "set_largo" && (s2p1 === "" || s2p2 === "")) {
        setError("Completa el puntaje del Set 2");
        return;
      }
    }
    setError(null);
    setUiStep(2);
  }

  function handleConfirmAndSubmit() {
    setError(null);

    let sets: ParsedSet[] | undefined;

    if (format && format !== "wo" && format !== "empate") {
      const g1p1 = parseInt(s1p1, 10);
      const g1p2 = parseInt(s1p2, 10);
      sets = [
        buildSetFromDisplayOrder({
          setNumber: 1,
          playerGames: g1p1,
          opponentGames: g1p2,
          shouldSwap: shouldSwapScores,
        }),
      ];

      if (format !== "set_largo") {
        const g2p1 = parseInt(s2p1, 10);
        const g2p2 = parseInt(s2p2, 10);
        sets.push(
          buildSetFromDisplayOrder({
            setNumber: 2,
            playerGames: g2p1,
            opponentGames: g2p2,
            shouldSwap: shouldSwapScores,
          }),
        );

        if (hasSet3) {
          const g3p1 = parseInt(s3p1, 10);
          const g3p2 = parseInt(s3p2, 10);
          if (!Number.isNaN(g3p1) && !Number.isNaN(g3p2)) {
            sets.push(
              buildSetFromDisplayOrder({
                setNumber: 3,
                playerGames: g3p1,
                opponentGames: g3p2,
                shouldSwap: shouldSwapScores,
              }),
            );
          }
        }
      }
    }

    const base = {
      format: format!,
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
        setUiStep(1);
      } else {
        setUiStep(3);
      }
    });
  }

  // ── Step 3: Success ───────────────────────────────────────────────────────
  if (uiStep === 3) {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-400 bg-emerald-50">
          <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
        </div>

        <div className="text-center">
          <h2 className="mb-1 text-xl font-bold text-slate-900">
            ¡Resultado enviado!
          </h2>
        </div>

        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {derivedWinnerName === displayPlayerName
              ? `${displayPlayerName} derrotó a ${displayOpponentName}`
              : derivedWinnerName === displayOpponentName
                ? `${displayOpponentName} derrotó a ${displayPlayerName}`
                : format === "empate"
                  ? `${displayPlayerName} vs ${displayOpponentName}`
                  : `${displayPlayerName} vs ${displayOpponentName}`}
          </p>

          {format !== "wo" && format !== "empate" ? (
            <>
              <div className="mb-2 flex items-center justify-center gap-4">
                <span
                  className={`tabular-nums text-4xl font-black ${setsWonP1 >= setsWonP2 ? "text-slate-900" : "text-slate-300"}`}
                >
                  {setsWonP1}
                </span>
                <span className="text-2xl font-light text-slate-400">-</span>
                <span
                  className={`tabular-nums text-4xl font-black ${setsWonP2 > setsWonP1 ? "text-slate-900" : "text-slate-300"}`}
                >
                  {setsWonP2}
                </span>
              </div>
              <div className="flex justify-center gap-3">
                {setsForReview.map((s, i) => (
                  <span key={i} className="text-sm font-medium text-slate-500">
                    {s.p1}-{s.p2}
                  </span>
                ))}
              </div>
            </>
          ) : format === "wo" ? (
            <p className="text-center text-sm font-medium text-slate-600">
              W.O. – ganó {derivedWinnerName ?? "—"}
            </p>
          ) : (
            <p className="text-center text-sm font-medium text-slate-600">
              Empate 1-1
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          <Link
            href={rankingHref}
            className="w-full rounded-2xl bg-clay px-6 py-4 text-center text-sm font-bold text-white transition hover:bg-clay/90"
          >
            Volver al ranking
          </Link>
          <button
            type="button"
            onClick={resetAll}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Ingresar otro resultado
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Review ────────────────────────────────────────────────────────
  if (uiStep === 2) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => {
            setUiStep(1);
            setError(null);
          }}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <StepIndicator current={2} />

        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">
            Revisar resultado
          </h1>
          <p className="text-sm text-slate-500">
            Confirma que el resultado sea correcto antes de enviarlo.
          </p>
        </div>

        {/* Match summary card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <PlayerCard
              name={displayPlayerName}
              isWinner={derivedWinnerName === displayPlayerName}
            />

            <div className="flex flex-col items-center gap-1">
              {format !== "wo" && format !== "empate" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`tabular-nums text-4xl font-black ${
                        setsWonP1 > setsWonP2 ? "text-clay" : "text-slate-300"
                      }`}
                    >
                      {setsWonP1}
                    </span>
                    <span className="text-2xl font-light text-slate-400">
                      -
                    </span>
                    <span
                      className={`tabular-nums text-4xl font-black ${
                        setsWonP2 > setsWonP1 ? "text-clay" : "text-slate-300"
                      }`}
                    >
                      {setsWonP2}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {setsForReview.map((s, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium text-slate-400"
                      >
                        {s.p1}-{s.p2}
                      </span>
                    ))}
                  </div>
                </>
              ) : format === "empate" ? (
                <span className="tabular-nums text-2xl font-black text-slate-600">
                  1-1
                </span>
              ) : (
                <span className="text-lg font-bold text-slate-600">W.O.</span>
              )}
            </div>

            <PlayerCard
              name={displayOpponentName}
              isWinner={derivedWinnerName === displayOpponentName}
            />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-600">
            El resultado será enviado a{" "}
            <strong>{displayOpponentName}</strong> para su confirmación.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirmAndSubmit}
          disabled={isPending}
          className="w-full rounded-2xl bg-clay px-6 py-4 text-sm font-bold text-white transition hover:bg-clay/90 disabled:opacity-40"
        >
          {isPending ? "Enviando..." : "Confirmar y enviar"}
        </button>
      </div>
    );
  }

  // ── Step 1: Entry ─────────────────────────────────────────────────────────
  const matchSelected = matchSelection !== null;
  const opponentResolved =
    matchSelection !== "new" || (matchSelection === "new" && !!opponentId);

  return (
    <div className="space-y-5">
      <StepIndicator current={1} />

      <h1 className="text-2xl font-bold text-slate-900">Reportar resultado</h1>

      {/* Match selection */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                className={`w-full rounded-2xl border p-3.5 text-left transition ${
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
            className={`w-full rounded-2xl border p-3.5 text-left transition ${
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
              <label
                htmlFor={opponentSelectId}
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Rival
              </label>
              <select
                id={opponentSelectId}
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
              <span className="text-sm text-slate-700">Fue un desafío</span>
            </label>
          </div>
        )}
      </div>

      {/* Players display */}
      {matchSelected && opponentResolved && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Jugadores
          </p>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0d1b2a] text-sm font-bold text-white">
                {displayPlayerName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w.charAt(0).toUpperCase())
                  .join("")}
              </div>
              <span className="truncate text-sm font-semibold text-slate-900">
                {displayPlayerName}
              </span>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-400">
              vs
            </span>
            <div className="flex flex-1 items-center justify-end gap-3">
              <span className="truncate text-right text-sm font-semibold text-slate-900">
                {displayOpponentName}
              </span>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                {displayOpponentName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w.charAt(0).toUpperCase())
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Format */}
      {matchSelected && opponentResolved && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Formato del partido
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
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
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
      )}

      {/* W.O. winner selection */}
      {format === "wo" && matchSelected && opponentResolved && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ¿Quién ganó?
          </p>
          <div className="flex gap-3">
            <PlayerCard
              name={displayPlayerName}
              isSelected={woWinnerId === displayPlayerId}
              onClick={() => setWoWinnerId(displayPlayerId)}
            />
            <PlayerCard
              name={displayOpponentName}
              isSelected={woWinnerId === displayOpponentId}
              onClick={() => {
                if (displayOpponentId) setWoWinnerId(displayOpponentId);
              }}
              disabled={!displayOpponentId}
            />
          </div>
        </div>
      )}

      {/* Scores */}
      {format && format !== "wo" && format !== "empate" && matchSelected && opponentResolved && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Resultado por sets
          </p>
          <div className="grid grid-cols-2 gap-3 px-0.5">
            <span className="truncate text-xs font-semibold text-slate-700">
              {displayPlayerName}
            </span>
            <span className="truncate text-xs font-semibold text-slate-700">
              {displayOpponentName}
            </span>
          </div>

          <SetScoreFields
            label="Set 1"
            vp1={s1p1}
            onP1Change={setS1p1}
            vp2={s1p2}
            onP2Change={setS1p2}
            maxGames={format === "set_largo" ? 9 : 7}
          />

          {format !== "set_largo" && (
            <SetScoreFields
              label="Set 2"
              vp1={s2p1}
              onP1Change={setS2p1}
              vp2={s2p2}
              onP2Change={setS2p2}
              maxGames={7}
            />
          )}

          {format === "mr3" && (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasSet3}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasSet3(checked);
                    setS3p1(checked ? "0" : "");
                    setS3p2(checked ? "0" : "");
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-clay"
                />
                <span className="text-sm text-slate-700">
                  Hubo 3er set (super tie-break)
                </span>
              </label>

              {hasSet3 && (
                <div className="grid grid-cols-2 gap-3">
                  <ScoreControl
                    value={s3p1}
                    onChange={setS3p1}
                    max={20}
                    ariaLabel="Set 3 super tie-break tu marcador"
                  />
                  <ScoreControl
                    value={s3p2}
                    onChange={setS3p2}
                    max={20}
                    ariaLabel="Set 3 super tie-break marcador rival"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Date */}
      {format && matchSelected && opponentResolved && (
        <div>
          <label
            htmlFor={playedOnInputId}
            className="mb-1 block text-xs font-medium text-slate-500"
          >
            Fecha del partido
          </label>
          <input
            id={playedOnInputId}
            type="date"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
          />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={validateAndGoToReview}
        disabled={
          matchSelection === null ||
          (matchSelection === "new" && !opponentId)
        }
        className="w-full rounded-2xl bg-clay px-6 py-4 text-sm font-bold text-white transition hover:bg-clay/90 disabled:opacity-40"
      >
        Siguiente →
      </button>
    </div>
  );
}
