"use client";

import {
  Check,
  CircleSlash,
  EllipsisVertical,
  Loader2,
  Pencil,
  Swords,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";

import {
  correctDrawAction,
  correctResultAction,
  correctWalkoverAction,
  deleteMatchAction,
  registerDrawAction,
  registerResultAction,
  registerWalkoverAction,
} from "@/app/fixture/match-admin-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTodayInSantiago } from "@/lib/date";

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

type ResultMode = "mr3" | "set_largo" | "draw" | "walkover";
type SetDraft = {
  gamesP1: string;
  gamesP2: string;
  tiebreakP1: string;
  tiebreakP2: string;
};

function getSet(sets: SetForAdminActions[], setNumber: number) {
  return sets.find((set) => set.setNumber === setNumber) ?? null;
}

function scoreDefault(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function buildSetDraft(sets: SetForAdminActions[], setNumber: 1 | 2 | 3) {
  const set = getSet(sets, setNumber);

  return {
    gamesP1: scoreDefault(set?.gamesP1),
    gamesP2: scoreDefault(set?.gamesP2),
    tiebreakP1: scoreDefault(set?.tiebreakP1),
    tiebreakP2: scoreDefault(set?.tiebreakP2),
  };
}

function getSetWinner(draft: SetDraft) {
  const gamesP1 = Number(draft.gamesP1);
  const gamesP2 = Number(draft.gamesP2);

  if (draft.gamesP1.trim() === "" || draft.gamesP2.trim() === "") return null;
  if (!Number.isFinite(gamesP1) || !Number.isFinite(gamesP2)) return null;
  if (gamesP1 === gamesP2) return null;

  return gamesP1 > gamesP2 ? 1 : 2;
}

function SetFields({
  draft,
  onDraftChange,
  setNumber,
  showTiebreak = true,
  label,
  player1Name,
  player2Name,
  required = false,
}: {
  draft: SetDraft;
  onDraftChange: (field: keyof SetDraft, value: string) => void;
  setNumber: 1 | 2 | 3;
  showTiebreak?: boolean;
  label?: string;
  player1Name: string;
  player2Name: string;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {label ?? `Set ${setNumber}`}
        </p>
        {showTiebreak ? (
          <span className="text-[11px] text-muted-foreground">TB opcional</span>
        ) : null}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="block truncate text-[11px] text-muted-foreground">
            {player1Name}
          </span>
          <input
            name={`set${setNumber}p1`}
            type="number"
            min={0}
            value={draft.gamesP1}
            onChange={(e) => onDraftChange("gamesP1", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
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
            value={draft.gamesP2}
            onChange={(e) => onDraftChange("gamesP2", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
            placeholder={setNumber === 3 ? "8" : "4"}
            required={required}
          />
        </label>
      </div>
      {showTiebreak ? (
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <input
            name={`set${setNumber}tbp1`}
            type="number"
            min={0}
            value={draft.tiebreakP1}
            onChange={(e) => onDraftChange("tiebreakP1", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
            placeholder="TB P1"
          />
          <input
            name={`set${setNumber}tbp2`}
            type="number"
            min={0}
            value={draft.tiebreakP2}
            onChange={(e) => onDraftChange("tiebreakP2", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
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

function SaveToast({
  status,
  onDismiss,
}: {
  status: "saving" | "saved";
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [status, onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-lg">
      {status === "saving" ? (
        <Loader2 className="size-4 animate-spin text-slate-400" />
      ) : (
        <Check className="size-4 text-emerald-400" />
      )}
      {status === "saving" ? "Guardando..." : "Resultado guardado exitosamente"}
    </div>
  );
}

export function FixtureAdminActions({ match, sets }: FixtureAdminActionsProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<"saving" | "saved" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<ResultMode>(() => {
    if (match.status === "wo") return "walkover";
    if (match.status === "empate") return "draw";
    if (match.format === "set_largo") return "set_largo";
    return "mr3";
  });
  const [setDrafts, setSetDrafts] = useState<Record<1 | 2 | 3, SetDraft>>(
    () => ({
      1: buildSetDraft(sets, 1),
      2: buildSetDraft(sets, 2),
      3: buildSetDraft(sets, 3),
    }),
  );
  const [markMr3Draw, setMarkMr3Draw] = useState(match.status === "empate");
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
  const isMr3Mode = mode === "mr3";
  const firstSetWinner = getSetWinner(setDrafts[1]);
  const secondSetWinner = getSetWinner(setDrafts[2]);
  const isSplitAfterTwoSets =
    firstSetWinner != null &&
    secondSetWinner != null &&
    firstSetWinner !== secondSetWinner;
  const showSuperTiebreak = isMr3Mode && isSplitAfterTwoSets && !markMr3Draw;
  const shouldSubmitDraw =
    isDrawMode || (isMr3Mode && isSplitAfterTwoSets && markMr3Draw);
  const mainAction = shouldSubmitDraw ? drawAction : resultAction;
  const mainFormat = isSetLargoMode ? "set_largo" : "mr3";
  const mainSubmitLabel = isResolved
    ? shouldSubmitDraw
      ? "Corregir a empate"
      : "Guardar corrección"
    : shouldSubmitDraw
      ? "Marcar empate"
      : "Confirmar resultado";
  const defaultPlayedOn = match.playedOn ?? getTodayInSantiago();

  function updateSetDraft(
    setNumber: 1 | 2 | 3,
    field: keyof SetDraft,
    value: string,
  ) {
    setSetDrafts((current) => ({
      ...current,
      [setNumber]: {
        ...current[setNumber],
        [field]: value,
      },
    }));
  }

  function handleWalkoverSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setResultOpen(false);
    setToast("saving");
    startTransition(async () => {
      await walkoverAction(formData);
      setToast("saved");
    });
  }

  function handleMainSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setResultOpen(false);
    setToast("saving");
    startTransition(async () => {
      await mainAction(formData);
      setToast("saved");
    });
  }

  function handleDeleteConfirm() {
    setDeleteError(null);
    setIsDeleting(true);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("matchId", match.id);
        await deleteMatchAction(formData);
        setDeleteOpen(false);
        setMenuOpen(false);
        router.refresh();
      } catch (err) {
        setDeleteError(
          err instanceof Error ? err.message : "No se pudo eliminar el partido",
        );
        setIsDeleting(false);
      }
    });
  }

  return (
    <div className="relative">
      {isDeleting && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex min-w-56 flex-col items-center gap-3 rounded-xl border border-border bg-popover px-6 py-5 text-popover-foreground shadow-xl">
            <Loader2 className="size-6 animate-spin text-court" />
            <div className="text-center">
              <p className="text-sm font-semibold">Eliminando partido</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Espera un momento...
              </p>
            </div>
          </div>
        </div>
      )}
      {toast !== null && (
        <SaveToast status={toast} onDismiss={() => setToast(null)} />
      )}
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

          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
            Eliminar partido
          </button>
        </div>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={!isDeleting}>
          <DialogHeader>
            <DialogTitle>Eliminar partido</DialogTitle>
            <DialogDescription>
              {match.player1Name} vs {match.player2Name}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-foreground">
            Esta acción eliminará el partido definitivamente y actualizará el
            ranking asociado.
          </div>

          {deleteError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm font-medium text-destructive">
              {deleteError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting || isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting || isPending}
              className="gap-2"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {isDeleting ? "Eliminando" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar resultado</DialogTitle>
            <DialogDescription>
              {match.player1Name} vs {match.player2Name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ModeButton
                active={mode === "mr3"}
                onClick={() => {
                  setMode("mr3");
                  setMarkMr3Draw(false);
                }}
              >
                Mejor de 3 sets
              </ModeButton>
              <ModeButton
                active={mode === "set_largo"}
                onClick={() => {
                  setMode("set_largo");
                  setMarkMr3Draw(false);
                }}
              >
                Set largo
              </ModeButton>
              <ModeButton
                active={mode === "draw"}
                onClick={() => {
                  setMode("draw");
                  setMarkMr3Draw(true);
                }}
              >
                Empate
              </ModeButton>
              <ModeButton
                active={mode === "walkover"}
                onClick={() => {
                  setMode("walkover");
                  setMarkMr3Draw(false);
                }}
              >
                Retiro / W.O.
              </ModeButton>
            </div>

            {isWalkoverMode ? (
              <form
                onSubmit={handleWalkoverSubmit}
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
                    defaultValue={defaultPlayedOn}
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
              <form onSubmit={handleMainSubmit} className="space-y-4">
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
                              : "Mejor de 3 sets"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isDrawMode
                            ? "Carga dos sets, uno para cada jugador."
                            : isSetLargoMode
                              ? "Un set a 9 juegos; si fue 9-8, informa el tie-break."
                              : "Si quedan 1-1, se abre el super tie-break a 10."}
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
                      defaultValue={defaultPlayedOn}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-court"
                    />
                  </label>
                </div>

                <div
                  className={`grid gap-3 ${
                    isSetLargoMode ? "md:grid-cols-1" : "md:grid-cols-2"
                  } ${showSuperTiebreak ? "lg:grid-cols-3" : ""}`}
                >
                  <SetFields
                    draft={setDrafts[1]}
                    onDraftChange={(field, value) =>
                      updateSetDraft(1, field, value)
                    }
                    setNumber={1}
                    label={isSetLargoMode ? "Set largo" : "Set 1"}
                    player1Name={match.player1Name}
                    player2Name={match.player2Name}
                    required
                  />
                  {!isSetLargoMode && (
                    <SetFields
                      draft={setDrafts[2]}
                      onDraftChange={(field, value) =>
                        updateSetDraft(2, field, value)
                      }
                      setNumber={2}
                      player1Name={match.player1Name}
                      player2Name={match.player2Name}
                      required
                    />
                  )}
                  {showSuperTiebreak && (
                    <SetFields
                      draft={setDrafts[3]}
                      onDraftChange={(field, value) =>
                        updateSetDraft(3, field, value)
                      }
                      setNumber={3}
                      label="Super tie-break"
                      showTiebreak={false}
                      player1Name={match.player1Name}
                      player2Name={match.player2Name}
                      required
                    />
                  )}
                </div>

                {isMr3Mode && isSplitAfterTwoSets ? (
                  <label className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                    <input
                      type="checkbox"
                      checked={markMr3Draw}
                      onChange={(e) => setMarkMr3Draw(e.target.checked)}
                      className="mt-1 size-4 rounded border-blue-300"
                    />
                    <span>
                      <span className="block font-semibold">
                        Marcar como empate
                      </span>
                      <span className="mt-1 block text-xs text-blue-900/75">
                        Úsalo si quedaron 1-1 en sets y no se jugó el super
                        tie-break.
                      </span>
                    </span>
                  </label>
                ) : null}

                <SubmitButton tone={shouldSubmitDraw ? "blue" : "default"}>
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
