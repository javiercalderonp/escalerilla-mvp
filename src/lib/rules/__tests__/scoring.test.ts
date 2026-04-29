import { describe, expect, it } from "vitest";

import {
  calculateMatchPoints,
  getLoserReason,
  isValidMatchScore,
  isValidSet,
} from "../scoring";

describe("isValidSet", () => {
  it("acepta set corto válido", () => {
    expect(
      isValidSet({ gamesP1: 6, gamesP2: 4 }, { format: "mr3", setNumber: 1 }),
    ).toEqual({ valid: true });
  });

  it("acepta 7-6 con tie-break", () => {
    expect(
      isValidSet(
        { gamesP1: 7, gamesP2: 6, tiebreakP1: 7, tiebreakP2: 3 },
        { format: "mr3", setNumber: 1 },
      ),
    ).toEqual({ valid: true });
  });

  it("rechaza 7-6 sin tie-break", () => {
    expect(
      isValidSet({ gamesP1: 7, gamesP2: 6 }, { format: "mr3", setNumber: 1 }),
    ).toEqual({
      valid: false,
      reason: "El 7-6 requiere tie-break informado",
    });
  });

  it("rechaza 10-9 en super tie-break", () => {
    expect(
      isValidSet({ gamesP1: 10, gamesP2: 9 }, { format: "mr3", setNumber: 3 }),
    ).toEqual({
      valid: false,
      reason: "El super tie-break requiere diferencia mínima de 2",
    });
  });

  it("acepta 9-8 con tie-break en set largo", () => {
    expect(
      isValidSet(
        { gamesP1: 9, gamesP2: 8, tiebreakP1: 7, tiebreakP2: 4 },
        { format: "set_largo", setNumber: 1 },
      ),
    ).toEqual({ valid: true });
  });
});

describe("isValidMatchScore", () => {
  it("acepta MR3 con ganador claro en 3 sets", () => {
    expect(
      isValidMatchScore(
        [
          { gamesP1: 6, gamesP2: 4 },
          { gamesP1: 3, gamesP2: 6 },
          { gamesP1: 10, gamesP2: 7 },
        ],
        "mr3",
        false,
      ),
    ).toEqual({ valid: true, winnerIndex: 1 });
  });

  it("rechaza empate en set largo MVP", () => {
    expect(
      isValidMatchScore([{ gamesP1: 9, gamesP2: 7 }], "set_largo", true),
    ).toEqual({
      valid: false,
      reason: "Empate en set largo no soportado en MVP",
    });
  });

  it("acepta empate MR3 1-1", () => {
    expect(
      isValidMatchScore(
        [
          { gamesP1: 6, gamesP2: 4 },
          { gamesP1: 3, gamesP2: 6 },
        ],
        "mr3",
        true,
      ),
    ).toEqual({ valid: true, winnerIndex: null });
  });

  it("rechaza MR3 1-1 sin empate declarado", () => {
    expect(
      isValidMatchScore(
        [
          { gamesP1: 6, gamesP2: 4 },
          { gamesP1: 3, gamesP2: 6 },
        ],
        "mr3",
        false,
      ),
    ).toEqual({
      valid: false,
      reason: "Falta desempatar el partido o marcar empate",
    });
  });

  it("rechaza MR3 con set incompleto resuelto como 6-5", () => {
    expect(
      isValidMatchScore(
        [
          { gamesP1: 6, gamesP2: 5 },
          { gamesP1: 6, gamesP2: 3 },
        ],
        "mr3",
        false,
      ),
    ).toEqual({
      valid: false,
      reason: "Set corto inválido",
    });
  });
});

describe("calculateMatchPoints", () => {
  it("puntúa MR3 en 2 sets", () => {
    expect(
      calculateMatchPoints({
        type: "win_loss",
        format: "mr3",
        winnerWent3Sets: false,
      }),
    ).toEqual({ winner: 60, loser: 20 });
  });

  it("puntúa empate", () => {
    expect(calculateMatchPoints({ type: "draw" })).toEqual({ both: 35 });
  });

  it("puntúa W.O.", () => {
    expect(calculateMatchPoints({ type: "wo" })).toEqual({
      winner: 60,
      loser: -20,
    });
  });
});

describe("getLoserReason", () => {
  it("devuelve match_loss_3s cuando corresponde", () => {
    expect(getLoserReason("mr3", true)).toBe("match_loss_3s");
  });
});
