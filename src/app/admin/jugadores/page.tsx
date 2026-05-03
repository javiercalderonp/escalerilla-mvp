import { asc, eq, sql } from "drizzle-orm";
import { Check, Pencil, Plus, Trash2, Undo2, UserMinus } from "lucide-react";
import { redirect } from "next/navigation";

import {
  approvePlayerAction,
  createPlayerAction,
  deletePlayerAction,
  toggleRetiredPlayerAction,
  updatePlayerAction,
} from "@/app/admin/jugadores/actions";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { players, rankingEvents } from "@/lib/db/schema";

async function getPlayers() {
  if (!db) {
    return [];
  }

  const pointTotals = db.$with("point_totals").as(
    db
      .select({
        playerId: rankingEvents.playerId,
        points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`.as(
          "points",
        ),
      })
      .from(rankingEvents)
      .groupBy(rankingEvents.playerId),
  );

  return db
    .with(pointTotals)
    .select()
    .from(players)
    .leftJoin(pointTotals, eq(pointTotals.playerId, players.id))
    .orderBy(asc(players.gender), asc(players.fullName));
}

function statusBadge(
  status: "pendiente" | "activo" | "congelado" | "retirado",
) {
  const styles = {
    pendiente: "bg-orange-100 text-orange-800",
    activo: "bg-emerald-100 text-emerald-800",
    congelado: "bg-amber-100 text-amber-800",
    retirado: "bg-slate-200 text-slate-700",
  } as const;

  return <Badge className={styles[status]}>{status}</Badge>;
}

function levelBadge(level: string | null) {
  if (!level) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  return <Badge variant="court">{level.replaceAll("_", " ")}</Badge>;
}

type PlayerRow = Awaited<ReturnType<typeof getPlayers>>[number];

function getCurrentPoints(player: PlayerRow) {
  return Number(player.point_totals?.points ?? 0);
}

function getDominantHandInitial(hand: PlayerRow["players"]["dominantHand"]) {
  if (hand === "diestro") {
    return "D";
  }

  if (hand === "zurdo") {
    return "Z";
  }

  return "—";
}

function calculateAge(birthDate: PlayerRow["players"]["birthDate"]) {
  if (!birthDate) {
    return null;
  }

  const [year, month, day] = birthDate.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthday =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasHadBirthday) {
    age -= 1;
  }

  return age;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500";

function PlayerFields({ player }: { player?: PlayerRow }) {
  const playerData = player?.players;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
        <span className="font-medium">Nombre completo</span>
        <input
          name="fullName"
          defaultValue={playerData?.fullName ?? ""}
          required
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={playerData?.email ?? ""}
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Categoría</span>
        <select
          name="gender"
          defaultValue={playerData?.gender ?? "M"}
          className={inputClass}
        >
          <option value="M">Hombres</option>
          <option value="F">Mujeres</option>
        </select>
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Puntos iniciales</span>
        <input
          name="initialPoints"
          type="number"
          min={0}
          defaultValue={playerData?.initialPoints ?? 0}
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Nivel</span>
        <select
          name="level"
          defaultValue={playerData?.level ?? ""}
          className={inputClass}
        >
          <option value="">Sin definir</option>
          <option value="principiante">Principiante</option>
          <option value="intermedio_bajo">Intermedio bajo</option>
          <option value="intermedio_alto">Intermedio alto</option>
          <option value="avanzado">Avanzado</option>
        </select>
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Estado</span>
        <select
          name="status"
          defaultValue={playerData?.status ?? "activo"}
          className={inputClass}
        >
          {playerData?.status === "pendiente" ? (
            <option value="pendiente">Pendiente</option>
          ) : null}
          <option value="activo">Activo</option>
          <option value="congelado">Congelado</option>
          <option value="retirado">Retirado</option>
        </select>
      </label>

      <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
        <span className="font-medium">Notas</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={playerData?.notes ?? ""}
          className={inputClass}
        />
      </label>
    </div>
  );
}

function CreatePlayerDialog() {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-950/20">
        <Plus className="size-5" />
        Nuevo jugador
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar jugador</DialogTitle>
          <DialogDescription>
            Crea un alta individual para el plantel.
          </DialogDescription>
        </DialogHeader>

        <form action={createPlayerAction} className="space-y-5">
          <PlayerFields />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Guardar jugador
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPlayerDialog({ player }: { player: PlayerRow }) {
  const playerData = player.players;

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Editar ${playerData.fullName}`}
        title={`Editar ${playerData.fullName}`}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-950/10"
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar jugador</DialogTitle>
          <DialogDescription>{playerData.fullName}</DialogDescription>
        </DialogHeader>

        <form action={updatePlayerAction} className="space-y-5">
          <input type="hidden" name="playerId" value={playerData.id} />
          <PlayerFields player={player} />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlayerDialog({ player }: { player: PlayerRow["players"] }) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Eliminar definitivamente ${player.fullName}`}
        title={`Eliminar definitivamente ${player.fullName}`}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-red-600/20"
      >
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar jugador</DialogTitle>
          <DialogDescription>
            Esto borra definitivamente a {player.fullName}. Si el jugador ya
            tiene historial, la acción se bloqueará y conviene retirarlo.
          </DialogDescription>
        </DialogHeader>

        <form action={deletePlayerAction}>
          <input type="hidden" name="playerId" value={player.id} />
          <DialogFooter>
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-red-600/20"
            >
              Eliminar definitivamente
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default async function AdminPlayersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const rows = await getPlayers();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Jugadores
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Revisa el plantel completo, edita datos en una ventana emergente y
              elimina jugadores del listado activo.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {rows.length} jugadores cargados
            </div>
            <CreatePlayerDialog />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Jugadores</h2>
            <p className="mt-2 text-sm text-slate-600">
              Todos los jugadores registrados, con edición y eliminación por
              fila.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
              Aún no hay jugadores cargados en la base.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-4">Jugador</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-center">Mano</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Edad</TableHead>
                    <TableHead className="text-right">Puntos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-4 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const player = row.players;
                    const age = calculateAge(player.birthDate);
                    const isRetired = player.status === "retirado";
                    const nextStatus = isRetired ? "activo" : "retirado";
                    const retireLabel = isRetired
                      ? `Reactivar ${player.fullName}`
                      : `Retirar ${player.fullName}`;

                    return (
                      <TableRow key={player.id}>
                        <TableCell className="px-4 font-medium text-slate-950">
                          {player.fullName}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {player.email ?? "Sin email"}
                        </TableCell>
                        <TableCell>
                          {player.gender === "M" ? "Hombres" : "Mujeres"}
                        </TableCell>
                        <TableCell>{levelBadge(player.level)}</TableCell>
                        <TableCell className="text-center font-medium text-slate-700">
                          {getDominantHandInitial(player.dominantHand)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {player.phone ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {age === null ? "—" : age}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {getCurrentPoints(row)}
                        </TableCell>
                        <TableCell>{statusBadge(player.status)}</TableCell>
                        <TableCell className="pr-4">
                          <div className="flex justify-end gap-2">
                            {player.status === "pendiente" ? (
                              <form action={approvePlayerAction}>
                                <input
                                  type="hidden"
                                  name="playerId"
                                  value={player.id}
                                />
                                <button
                                  type="submit"
                                  aria-label={`Aprobar ${player.fullName}`}
                                  title={`Aprobar ${player.fullName}`}
                                  className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-600/20"
                                >
                                  <Check className="size-4" />
                                </button>
                              </form>
                            ) : null}
                            <EditPlayerDialog player={row} />
                            <form action={toggleRetiredPlayerAction}>
                              <input
                                type="hidden"
                                name="playerId"
                                value={player.id}
                              />
                              <input
                                type="hidden"
                                name="nextStatus"
                                value={nextStatus}
                              />
                              <button
                                type="submit"
                                aria-label={retireLabel}
                                title={retireLabel}
                                className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-amber-600/20"
                              >
                                {isRetired ? (
                                  <Undo2 className="size-4" />
                                ) : (
                                  <UserMinus className="size-4" />
                                )}
                              </button>
                            </form>
                            <DeletePlayerDialog player={player} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
