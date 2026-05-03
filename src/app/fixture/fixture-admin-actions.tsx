"use client";

import {
  CircleSlash,
  EllipsisVertical,
  Pencil,
  Swords,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  correctDrawAction,
  correctResultAction,
  correctWalkoverAction,
  deleteMatchAction,
  registerDrawAction,
  registerResultAction,
  registerWalkoverAction,
} from "@/app/admin/partidos/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MatchStatus = "pendiente" | "reportado" | "confirmado" | "wo" | "empate";

type MatchForAdminActions = {
  id: string;
  status: MatchStatus;
  format: "mr3" | "set_largo" | null;
  playedOn: string | null;
  winnerId: string | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
};

type SetForAdminActions = {
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

type FixtureAdminActionsProps = {
  match: MatchForAdminActions;
  sets: SetForAdminActions[];
};

type ResultMode = "mr3_2" | "mr3_3" | "set_largo" | "draw" | "walkover";

function getSet(sets: SetForAdminActions[], setNumber: number) {
  return sets.find((set) => set.setNumber === setNumber) ?? null;
}

function scoreDefault(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function SetFields({
  sets,
  setNumber,
  showTiebreak = true,
  label,
  player1Name,
  player2Name,
  required = false,
}: {
  sets: SetForAdminActions[];
  setNumber: 1 | 2 | 3;
  showTiebreak?: boolean;
  label?: string;
  player1Name: string;
  player2Name: string;
  required?: boolean;
}) {
  const set = getSet(sets, setNumber);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {label ?? `Set ${setNumber}`}
        </p>
        {showTiebreak ? (
          <span className="text-[11px] text-muted-foreground">TB opcional</span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="block truncate text-[11px] text-muted-foreground">
            {player1Name}
          </span>
          <input
            name={`set${setNumber}p1`}
            type="number"
            min={0}
            defaultValue={scoreDefault(set?.gamesP1)}
            className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
            placeholder={setNumber === 3 ? "10" : "6"}
            required={required}
          />
        </label>
        <label className="space-y-1">
          <span className="block truncate text-[11px] text-muted-foreground">
            {player2Name}
          </span>
          <input
            name={`set${setNumber}p2`}
            type="number"
            min={0}
            defaultValue={scoreDefault(set?.gamesP2)}
            className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
            placeholder={setNumber === 3 ? "8" : "4"}
            required={required}
          />
        </label>
      </div>
      {showTiebreak ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            name={`set${setNumber}tbp1`}
            type="number"
            min={0}
            defaultValue={scoreDefault(set?.tiebreakP1)}
            className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
            placeholder="TB P1"
          />
          <input
            name={`set${setNumber}tbp2`}
            type="number"
            min={0}
            defaultValue={scoreDefault(set?.tiebreakP2)}
            className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
            placeholder="TB P2"
          />
        </div>
      ) : null}
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
        active
          ? "border-court bg-court text-court-foreground"
          : "border-border bg-card text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function SubmitButton({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "blue" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : tone === "blue"
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : "bg-court text-court-foreground hover:bg-court/90";

  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${toneClass}`}
    >
      {children}
    </button>
  );
}

export function FixtureAdminActions({ match, sets }: FixtureAdminActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [mode, setMode] = useState<ResultMode>(() => {
    if (match.status === "wo") return "walkover";
    if (match.status === "empate") return "draw";
    if (match.format === "set_largo") return "set_largo";
    return sets.length >= 3 ? "mr3_3" : "mr3_2";
  });
  const isResolved =
    match.status === "confirmado" ||
    match.status === "empate" ||
    match.status === "wo";
  const resultAction = isResolved ? correctResultAction : registerResultAction;
  const drawAction = isResolved ? correctDrawAction : registerDrawAction;
  const walkoverAction = isResolved
    ? correctWalkoverAction
    : registerWalkoverAction;
  const defaultWinnerId = match.winnerId ?? match.player1Id;
  const isWalkoverMode = mode === "walkover";
  const isDrawMode = mode === "draw";
  const isSetLargoMode = mode === "set_largo";
  const isThreeSetMode = mode === "mr3_3";
  const mainAction = isDrawMode ? drawAction : resultAction;
  const mainFormat = isSetLargoMode ? "set_largo" : "mr3";
  const mainSubmitLabel = isResolved
    ? isDrawMode
      ? "Corregir a empate"
      : "Guardar corrección"
    : isDrawMode
      ? "Marcar empate"
      : "Confirmar resultado";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Opciones del partido"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="inline-flex size-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
      >
        <EllipsisVertical className="size-4" />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <button
            type="button"
            onClick={() => {
              setResultOpen(true);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted"
          >
            <Pencil className="size-4" />
            Editar resultado
          </button>

          <form
            action={deleteMatchAction}
            onSubmit={(event) => {
              if (!window.confirm("¿Eliminar este partido definitivamente?")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="matchId" value={match.id} />
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              Eliminar partido
            </button>
          </form>
        </div>
      ) : null}

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar resultado</DialogTitle>
            <DialogDescription>
              {match.player1Name} vs {match.player2Name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <ModeButton
                active={mode === "mr3_2"}
                onClick={() => setMode("mr3_2")}
              >
                2 sets
              </ModeButton>
              <ModeButton
                active={mode === "mr3_3"}
                onClick={() => setMode("mr3_3")}
              >
                3 sets
              </ModeButton>
              <ModeButton
                active={mode === "set_largo"}
                onClick={() => setMode("set_largo")}
              >
                Set largo
              </ModeButton>
              <ModeButton
                active={mode === "draw"}
                onClick={() => setMode("draw")}
              >
                Empate
              </ModeButton>
              <ModeButton
                active={mode === "walkover"}
                onClick={() => setMode("walkover")}
              >
                Retiro / W.O.
              </ModeButton>
            </div>

            {isWalkoverMode ? (
              <form
                action={walkoverAction}
                className="space-y-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4"
              >
                <input type="hidden" name="matchId" value={match.id} />
                <div className="flex items-start gap-3">
                  <CircleSlash className="mt-0.5 size-4 text-destructive" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Retiro o W.O.
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Elegí al ganador. La app aplica +60 al ganador y -20 al
                      rival.
                    </p>
                  </div>
                </div>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Ganador</span>
                  <select
                    name="winnerId"
                    defaultValue={defaultWinnerId}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-destructive"
                  >
                    <option value={match.player1Id}>{match.player1Name}</option>
                    <option value={match.player2Id}>{match.player2Name}</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">
                    Fecha registrada
                  </span>
                  <input
                    name="playedOn"
                    type="date"
                    defaultValue={match.playedOn ?? ""}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-destructive"
                  />
                </label>
                <SubmitButton tone="danger">
                  {isResolved
                    ? "Corregir retiro / W.O."
                    : "Guardar retiro / W.O."}
                </SubmitButton>
              </form>
            ) : (
              <form action={mainAction} className="space-y-4">
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="format" value={mainFormat} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/35 p-3">
                    <div className="flex items-start gap-2">
                      <Swords className="mt-0.5 size-4 text-court" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {isDrawMode
                            ? "Empate MR3"
                            : isSetLargoMode
                              ? "Set largo"
                              : isThreeSetMode
                                ? "Mejor de 3 sets"
                                : "Mejor de 3, resuelto en 2 sets"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isDrawMode
                            ? "Carga dos sets, uno para cada jugador."
                            : isSetLargoMode
                              ? "Un set a 9 juegos; si fue 9-8, informa el tie-break."
                              : isThreeSetMode
                                ? "El tercer set es super tie-break a 10."
                                : "Carga los dos primeros sets; el ganador se infiere."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">
                      Fecha jugada
                    </span>
                    <input
                      name="playedOn"
                      type="date"
                      defaultValue={match.playedOn ?? ""}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
                    />
                  </label>
                </div>

                <div
                  className={`grid gap-3 ${
                    isSetLargoMode ? "md:grid-cols-1" : "md:grid-cols-2"
                  } ${isThreeSetMode ? "lg:grid-cols-3" : ""}`}
                >
                  <SetFields
                    sets={sets}
                    setNumber={1}
                    label={isSetLargoMode ? "Set largo" : "Set 1"}
                    player1Name={match.player1Name}
                    player2Name={match.player2Name}
                    required
                  />
                  {!isSetLargoMode && (
                    <SetFields
                      sets={sets}
                      setNumber={2}
                      player1Name={match.player1Name}
                      player2Name={match.player2Name}
                      required
                    />
                  )}
                  {isThreeSetMode && (
                    <SetFields
                      sets={sets}
                      setNumber={3}
                      label="Super tie-break"
                      showTiebreak={false}
                      player1Name={match.player1Name}
                      player2Name={match.player2Name}
                      required
                    />
                  )}
                </div>

                <SubmitButton tone={isDrawMode ? "blue" : "default"}>
                  {mainSubmitLabel}
                </SubmitButton>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
