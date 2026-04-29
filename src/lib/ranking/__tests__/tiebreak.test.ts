import { describe, expect, it } from "vitest";

import { resolveTies, type TieBreakDeps } from "../tiebreak";

const baseDeps: TieBreakDeps = {
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

describe("resolveTies", () => {
  it("mantiene orden simple cuando no hay empates", async () => {
    const result = await resolveTies(
      [
        { id: "a", fullName: "Ana", points: 400 },
        { id: "b", fullName: "Beto", points: 380 },
      ],
      baseDeps,
    );

    expect(result.map((row) => row.id)).toEqual(["a", "b"]);
    expect(result.map((row) => row.position)).toEqual([1, 2]);
  });

  it("resuelve empate por H2H", async () => {
    const result = await resolveTies(
      [
        { id: "a", fullName: "Ana", points: 400 },
        { id: "b", fullName: "Beto", points: 400 },
      ],
      {
        ...baseDeps,
        async getHeadToHead(aId, bId) {
          if (aId === "a" && bId === "b") {
            return { winsA: 2, winsB: 1 };
          }

          return { winsA: 0, winsB: 0 };
        },
      },
    );

    expect(result.map((row) => row.id)).toEqual(["a", "b"]);
    expect(result[0].tieBreak.h2hScore).toBeGreaterThan(
      result[1].tieBreak.h2hScore,
    );
  });

  it("si H2H empata, usa sets y luego games", async () => {
    const result = await resolveTies(
      [
        { id: "a", fullName: "Ana", points: 400 },
        { id: "b", fullName: "Beto", points: 400 },
        { id: "c", fullName: "Carla", points: 400 },
      ],
      {
        ...baseDeps,
        async getSetDifferential(playerId) {
          return { a: 1, b: 3, c: 3 }[playerId] ?? 0;
        },
        async getGameDifferential(playerId) {
          return { a: 2, b: 4, c: 1 }[playerId] ?? 0;
        },
      },
    );

    expect(result.map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("si todo empata, cae a orden alfabético determinístico", async () => {
    const result = await resolveTies(
      [
        { id: "p", fullName: "Pedro", points: 400 },
        { id: "a", fullName: "Ana", points: 400 },
      ],
      baseDeps,
    );

    expect(result.map((row) => row.fullName)).toEqual(["Ana", "Pedro"]);
  });
});
