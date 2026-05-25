"use client";

import {
  CalendarPlus,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Swords,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FocusEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { createWeekAction } from "@/app/admin/semanas/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeSearchText } from "@/lib/utils";
import { createMatchAction } from "./match-admin-actions";

type PlayerOption = {
  id: string;
  fullName: string;
  gender: "M" | "F";
};

type CreateMode = "programming" | "match" | null;
type GenderFilter = "all" | "M" | "F";

function formatCategory(value: "M" | "F") {
  return value === "M" ? "Hombres" : "Mujeres";
}

function PlayerPicker({
  label,
  name,
  players,
  value,
  onChange,
  excludeId,
}: {
  label: string;
  name: string;
  players: PlayerOption[];
  value: string;
  onChange: (value: string) => void;
  excludeId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const rootRef = useRef<HTMLFieldSetElement>(null);

  const selectedPlayer = players.find((player) => player.id === value);
  const filteredPlayers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());

    return players.filter((player) => {
      const matchesGender =
        genderFilter === "all" || player.gender === genderFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        normalizeSearchText(player.fullName).includes(normalizedQuery);

      return matchesGender && matchesQuery;
    });
  }, [genderFilter, players, query]);

  function handleBlur(event: FocusEvent<HTMLFieldSetElement>) {
    if (!rootRef.current?.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  }

  return (
    <fieldset ref={rootRef} className="space-y-2" onBlur={handleBlur}>
      <input type="hidden" name={name} value={value} />
      <legend className="text-sm font-medium text-slate-700">{label}</legend>

      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-slate-300 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-100"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <UserRound className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-950">
              {selectedPlayer?.fullName ?? "Seleccionar jugador"}
            </span>
            {selectedPlayer ? (
              <span className="mt-0.5 block text-xs text-slate-500">
                {formatCategory(selectedPlayer.gender)}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-slate-400 transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 focus-within:border-emerald-500 focus-within:bg-white">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar jugador"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {[
              ["all", "Todos"],
              ["M", "Hombres"],
              ["F", "Mujeres"],
            ].map(([filterValue, filterLabel]) => (
              <button
                key={filterValue}
                type="button"
                className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                  genderFilter === filterValue
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setGenderFilter(filterValue as GenderFilter)}
              >
                {filterLabel}
              </button>
            ))}
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto pr-1">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map((player) => {
                const isSelected = player.id === value;
                const isExcluded = player.id === excludeId;

                return (
                  <button
                    key={player.id}
                    type="button"
                    disabled={isExcluded}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-slate-700 hover:bg-slate-50"
                    } ${isExcluded ? "cursor-not-allowed opacity-40" : ""}`}
                    onClick={() => {
                      onChange(player.id);
                      setQuery("");
                      setIsOpen(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {player.fullName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatCategory(player.gender)}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check className="size-4 shrink-0 text-emerald-600" />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2.5 py-6 text-center text-sm text-slate-500">
                Sin jugadores para ese filtro.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

export function AdminMatchesCreateMenu({
  playerOptions,
  programmingHref,
  nextWeekStartsOn,
}: {
  playerOptions: PlayerOption[];
  programmingHref: string | null;
  nextWeekStartsOn: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreateMode>(null);
  const [player1Id, setPlayer1Id] = useState(playerOptions[0]?.id ?? "");
  const [player2Id, setPlayer2Id] = useState(playerOptions[1]?.id ?? "");
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [createMatchError, setCreateMatchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [programmingToast, setProgrammingToast] = useState<
    "saving" | "saved" | null
  >(null);
  const [isProgrammingPending, startProgrammingTransition] = useTransition();

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    setPlayer1Id((current) => current || playerOptions[0]?.id || "");
    setPlayer2Id((current) => current || playerOptions[1]?.id || "");
  }, [playerOptions]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMode(null);
      setCreateMatchError(null);
    }
  }

  function handleProgrammingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setOpen(false);
    setMode(null);
    setProgrammingToast("saving");
    startProgrammingTransition(async () => {
      await createWeekAction(formData);
      setProgrammingToast("saved");
    });
  }

  async function handleCreateMatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMatchError(null);
    setIsCreatingMatch(true);

    const form = event.currentTarget;

    try {
      await createMatchAction(new FormData(form));
      form.reset();
      setPlayer1Id(playerOptions[0]?.id ?? "");
      setPlayer2Id(playerOptions[1]?.id ?? "");
      setOpen(false);
      setMode(null);
      setSuccessMessage("Partido creado");
      router.refresh();
    } catch (error) {
      setCreateMatchError(
        error instanceof Error ? error.message : "No se pudo crear el partido",
      );
    } finally {
      setIsCreatingMatch(false);
    }
  }

  return (
    <>
      {programmingToast !== null && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {programmingToast === "saving" ? (
            <Loader2 className="size-4 animate-spin text-slate-400" />
          ) : (
            <Check className="size-4 text-emerald-400" />
          )}
          {programmingToast === "saving"
            ? "Creando programación..."
            : "Programación creada"}
        </div>
      )}

      {successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 right-4 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-lg sm:bottom-8 sm:right-24"
        >
          {successMessage}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <Button
          type="button"
          size="icon-lg"
          className="rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          onClick={() => setOpen(true)}
          aria-label="Crear programación o partido"
          title="Crear programación o partido"
        >
          <Plus />
        </Button>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "programming"
                ? "Crear programación"
                : mode === "match"
                  ? "Agregar partido"
                  : "Nuevo"}
            </DialogTitle>
            <DialogDescription>
              {mode === "match"
                ? "Selecciona dos jugadores y marca si corresponde a desafío."
                : "Elige qué quieres crear desde partidos."}
            </DialogDescription>
          </DialogHeader>

          {mode === null ? (
            <div className="grid gap-3">
              {programmingHref ? (
                <Link
                  href={programmingHref}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CalendarPlus className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">
                      Crear programación
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Abrir jugadores de la semana y sorteo.
                    </span>
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                  onClick={() => setMode("programming")}
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CalendarPlus className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">
                      Crear programación
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Crear semana y abrir jugadores.
                    </span>
                  </span>
                </button>
              )}

              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setMode("match")}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Swords className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">
                    Agregar partido
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Crear un partido pendiente manualmente.
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {mode === "programming" ? (
            <form onSubmit={handleProgrammingSubmit} className="space-y-4">
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Inicio de semana</span>
                <input
                  name="startsOn"
                  type="date"
                  defaultValue={nextWeekStartsOn}
                  required
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                />
              </label>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(null)}
                  disabled={isProgrammingPending}
                >
                  Volver
                </Button>
                <Button type="submit" disabled={isProgrammingPending}>
                  Crear y agregar jugadores
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {mode === "match" ? (
            <form onSubmit={handleCreateMatchSubmit} className="space-y-4">
              <div className="grid gap-3">
                <PlayerPicker
                  label="Jugador 1"
                  name="player1Id"
                  players={playerOptions}
                  value={player1Id}
                  onChange={setPlayer1Id}
                  excludeId={player2Id}
                />

                <PlayerPicker
                  label="Jugador 2"
                  name="player2Id"
                  players={playerOptions}
                  value={player2Id}
                  onChange={setPlayer2Id}
                  excludeId={player1Id}
                />
              </div>

              <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <span className="font-medium">Es desafío</span>
                <input
                  name="isChallenge"
                  type="checkbox"
                  value="1"
                  className="size-4 accent-emerald-600"
                />
              </label>

              {createMatchError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createMatchError}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(null)}
                  disabled={isCreatingMatch}
                >
                  Volver
                </Button>
                <Button
                  type="submit"
                  disabled={playerOptions.length < 2 || isCreatingMatch}
                >
                  {isCreatingMatch ? "Creando..." : "Crear partido"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
