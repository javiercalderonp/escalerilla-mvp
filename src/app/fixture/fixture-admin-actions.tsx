"use client";

import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
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
  DialogTrigger,
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
}: {
  sets: SetForAdminActions[];
  setNumber: 1 | 2 | 3;
  showTiebreak?: boolean;
}) {
  const set = getSet(sets, setNumber);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Set {setNumber}</p>
        {showTiebreak ? (
          <span className="text-[11px] text-muted-foreground">TB opcional</span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          name={`set${setNumber}p1`}
          type="number"
          min={0}
          defaultValue={scoreDefault(set?.gamesP1)}
          className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
          placeholder="P1"
          required={setNumber === 1}
        />
        <input
          name={`set${setNumber}p2`}
          type="number"
          min={0}
          defaultValue={scoreDefault(set?.gamesP2)}
          className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
          placeholder="P2"
          required={setNumber === 1}
        />
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
  const isResolved =
    match.status === "confirmado" ||
    match.status === "empate" ||
    match.status === "wo";
  const resultAction = isResolved ? correctResultAction : registerResultAction;
  const drawAction = isResolved ? correctDrawAction : registerDrawAction;
  const walkoverAction = isResolved
    ? correctWalkoverAction
    : registerWalkoverAction;
  const defaultFormat = match.format ?? "mr3";
  const defaultWinnerId = match.winnerId ?? match.player1Id;

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
          <Dialog onOpenChange={() => setMenuOpen(false)}>
            <DialogTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted">
              <Pencil className="size-4" />
              Editar resultado
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Editar resultado</DialogTitle>
                <DialogDescription>
                  {match.player1Name} vs {match.player2Name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <form action={resultAction} className="space-y-4">
                  <input type="hidden" name="matchId" value={match.id} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-foreground">
                        Formato
                      </span>
                      <select
                        name="format"
                        defaultValue={defaultFormat}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
                      >
                        <option value="mr3">MR3</option>
                        <option value="set_largo">Set largo</option>
                      </select>
                    </label>
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

                  <div className="grid gap-3 md:grid-cols-3">
                    <SetFields sets={sets} setNumber={1} />
                    <SetFields sets={sets} setNumber={2} />
                    <SetFields sets={sets} setNumber={3} showTiebreak={false} />
                  </div>

                  <SubmitButton>
                    {isResolved ? "Guardar corrección" : "Confirmar resultado"}
                  </SubmitButton>
                </form>

                <div className="grid gap-4 lg:grid-cols-2">
                  <form
                    action={drawAction}
                    className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
                  >
                    <input type="hidden" name="matchId" value={match.id} />
                    <input type="hidden" name="format" value="mr3" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">
                        Empate
                      </h3>
                      <p className="mt-1 text-xs text-slate-600">
                        Carga un 1-1 válido en los dos primeros sets.
                      </p>
                    </div>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-800">
                        Fecha jugada
                      </span>
                      <input
                        name="playedOn"
                        type="date"
                        defaultValue={match.playedOn ?? ""}
                        className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SetFields sets={sets} setNumber={1} />
                      <SetFields sets={sets} setNumber={2} />
                    </div>
                    <SubmitButton tone="blue">
                      {isResolved ? "Corregir a empate" : "Marcar empate"}
                    </SubmitButton>
                  </form>

                  <form
                    action={walkoverAction}
                    className="space-y-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4"
                  >
                    <input type="hidden" name="matchId" value={match.id} />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        W.O.
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        El ganador suma 60 y el perdedor recibe -20.
                      </p>
                    </div>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-foreground">
                        Ganador por W.O.
                      </span>
                      <select
                        name="winnerId"
                        defaultValue={defaultWinnerId}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-destructive"
                      >
                        <option value={match.player1Id}>
                          {match.player1Name}
                        </option>
                        <option value={match.player2Id}>
                          {match.player2Name}
                        </option>
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
                      {isResolved ? "Corregir a W.O." : "Marcar W.O."}
                    </SubmitButton>
                  </form>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
    </div>
  );
}
