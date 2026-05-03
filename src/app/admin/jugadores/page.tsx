import { asc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { createPlayerAction } from "@/app/admin/jugadores/actions";
import { PlayerRowActions } from "@/app/admin/jugadores/player-row-actions";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
            <div className="rounded-2xl border border-slate-200">
              <Table className="table-fixed text-xs sm:text-sm">
                <colgroup>
                  <col className="w-[19%]" />
                  <col className="w-[22%]" />
                  <col className="w-[9%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[6%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[4%]" />
                </colgroup>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-2">Jugador</TableHead>
                    <TableHead className="px-1.5">Email</TableHead>
                    <TableHead className="px-1.5">Cat.</TableHead>
                    <TableHead className="px-1.5">Nivel</TableHead>
                    <TableHead className="px-1.5">Teléfono</TableHead>
                    <TableHead className="px-1.5 text-right">Edad</TableHead>
                    <TableHead className="px-1.5 text-right">Pts.</TableHead>
                    <TableHead className="px-1.5">Estado</TableHead>
                    <TableHead className="px-2 text-right">
                      <span className="sr-only">Opciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const player = row.players;
                    const age = calculateAge(player.birthDate);

                    return (
                      <TableRow key={player.id}>
                        <TableCell className="px-2 font-medium text-slate-950">
                          <div className="truncate" title={player.fullName}>
                            {player.fullName}
                          </div>
                        </TableCell>
                        <TableCell className="px-1.5 text-slate-600">
                          <div
                            className="truncate"
                            title={player.email ?? "Sin email"}
                          >
                            {player.email ?? "Sin email"}
                          </div>
                        </TableCell>
                        <TableCell className="px-1.5">
                          {player.gender === "M" ? "H" : "M"}
                        </TableCell>
                        <TableCell className="px-1.5">
                          <div className="truncate">
                            {levelBadge(player.level)}
                          </div>
                        </TableCell>
                        <TableCell className="px-1.5 text-slate-600">
                          <div className="truncate" title={player.phone ?? "—"}>
                            {player.phone ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="px-1.5 text-right tabular-nums text-slate-700">
                          {age === null ? "—" : age}
                        </TableCell>
                        <TableCell className="px-1.5 text-right tabular-nums">
                          {getCurrentPoints(row)}
                        </TableCell>
                        <TableCell className="px-1.5">
                          <div className="truncate">
                            {statusBadge(player.status)}
                          </div>
                        </TableCell>
                        <TableCell className="px-2">
                          <PlayerRowActions
                            player={{
                              id: player.id,
                              fullName: player.fullName,
                              email: player.email,
                              gender: player.gender,
                              initialPoints: player.initialPoints,
                              level: player.level,
                              status: player.status,
                              notes: player.notes,
                            }}
                          />
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
