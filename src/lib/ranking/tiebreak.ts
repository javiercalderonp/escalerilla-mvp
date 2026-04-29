export type TieRow = {
  id: string;
  fullName: string;
  points: number;
};

export type TieBreakDeps = {
  getHeadToHead: (
    aId: string,
    bId: string,
  ) => Promise<{ winsA: number; winsB: number }>;
  getSetDifferential: (playerId: string) => Promise<number>;
  getGameDifferential: (playerId: string) => Promise<number>;
};

export type TieBreakMeta = {
  h2hScore: number;
  setDifferential: number;
  gameDifferential: number;
};

export type RankedTieRow<T extends TieRow> = T & {
  position: number;
  tieBreak: TieBreakMeta;
};

type ResolvedTieRow<T extends TieRow> = T & {
  tieBreak: TieBreakMeta;
};

async function rankGroupByHeadToHead<T extends TieRow>(
  rows: T[],
  deps: TieBreakDeps,
): Promise<Array<T & { h2hScore: number }>> {
  const scores = new Map<string, number>();

  for (const row of rows) {
    scores.set(row.id, 0);
  }

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      const { winsA, winsB } = await deps.getHeadToHead(a.id, b.id);

      scores.set(a.id, (scores.get(a.id) ?? 0) + (winsA - winsB));
      scores.set(b.id, (scores.get(b.id) ?? 0) + (winsB - winsA));
    }
  }

  return rows.map((row) => ({
    ...row,
    h2hScore: scores.get(row.id) ?? 0,
  }));
}

async function enrichWithDifferentials<T extends TieRow & { h2hScore: number }>(
  rows: T[],
  deps: TieBreakDeps,
): Promise<Array<T & { setDifferential: number; gameDifferential: number }>> {
  const enriched = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      setDifferential: await deps.getSetDifferential(row.id),
      gameDifferential: await deps.getGameDifferential(row.id),
    })),
  );

  return enriched;
}

function compareAlphabetically(
  a: { fullName: string },
  b: { fullName: string },
) {
  return a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" });
}

function compareTieBreakers(
  a: {
    h2hScore: number;
    setDifferential: number;
    gameDifferential: number;
    fullName: string;
  },
  b: {
    h2hScore: number;
    setDifferential: number;
    gameDifferential: number;
    fullName: string;
  },
) {
  if (b.h2hScore !== a.h2hScore) {
    return b.h2hScore - a.h2hScore;
  }

  if (b.setDifferential !== a.setDifferential) {
    return b.setDifferential - a.setDifferential;
  }

  if (b.gameDifferential !== a.gameDifferential) {
    return b.gameDifferential - a.gameDifferential;
  }

  return compareAlphabetically(a, b);
}

export async function resolveTies<T extends TieRow>(
  rows: T[],
  deps: TieBreakDeps,
): Promise<Array<RankedTieRow<T>>> {
  const pointGroups = new Map<number, T[]>();

  for (const row of rows) {
    const group = pointGroups.get(row.points) ?? [];
    group.push(row);
    pointGroups.set(row.points, group);
  }

  const orderedPoints = [...pointGroups.keys()].sort((a, b) => b - a);
  const resolvedRows: ResolvedTieRow<T>[] = [];

  for (const points of orderedPoints) {
    const group = pointGroups.get(points) ?? [];

    if (group.length === 1) {
      const row = group[0];
      resolvedRows.push({
        ...row,
        tieBreak: {
          h2hScore: 0,
          setDifferential: 0,
          gameDifferential: 0,
        },
      } as ResolvedTieRow<T>);
      continue;
    }

    const withH2H = await rankGroupByHeadToHead(group, deps);
    const enriched = await enrichWithDifferentials(withH2H, deps);
    const ordered = enriched.sort(compareTieBreakers);

    resolvedRows.push(
      ...ordered.map(
        (row) =>
          ({
            ...row,
            tieBreak: {
              h2hScore: row.h2hScore,
              setDifferential: row.setDifferential,
              gameDifferential: row.gameDifferential,
            },
          }) as ResolvedTieRow<T>,
      ),
    );
  }

  return resolvedRows.map((row, index) => ({
    ...row,
    position: index + 1,
  }));
}

export function createZeroTieBreakDeps(): TieBreakDeps {
  return {
    async getHeadToHead() {
      return { winsA: 0, winsB: 0 };
    },
    async getSetDifferential() {
      return 0;
    },
    async getGameDifferential() {
      return 0;
    },
  };
}
