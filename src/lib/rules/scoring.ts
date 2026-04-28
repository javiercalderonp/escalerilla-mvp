export type MatchFormat = "mr3" | "set_largo";

export type SetInput = {
  gamesP1: number;
  gamesP2: number;
  tiebreakP1?: number | null;
  tiebreakP2?: number | null;
};

export type ValidationContext = {
  format: MatchFormat;
  setNumber: 1 | 2 | 3;
};

export type MatchOutcome =
  | { type: "win_loss"; format: MatchFormat; winnerWent3Sets: boolean }
  | { type: "draw" }
  | { type: "wo" };

export function isValidSet(set: SetInput, ctx: ValidationContext) {
  const { gamesP1, gamesP2, tiebreakP1, tiebreakP2 } = set;
  const maxGames = Math.max(gamesP1, gamesP2);
  const minGames = Math.min(gamesP1, gamesP2);
  const hasTiebreak = tiebreakP1 != null && tiebreakP2 != null;

  if (gamesP1 === gamesP2) {
    return {
      valid: false as const,
      reason: "Un set no puede terminar empatado",
    };
  }

  if (ctx.format === "mr3" && ctx.setNumber === 3) {
    if (maxGames < 10) {
      return {
        valid: false as const,
        reason: "El super tie-break debe llegar al menos a 10",
      };
    }

    if (maxGames - minGames < 2) {
      return {
        valid: false as const,
        reason: "El super tie-break requiere diferencia mínima de 2",
      };
    }

    return { valid: true as const };
  }

  if (ctx.format === "set_largo") {
    if (maxGames === 9 && minGames <= 7) {
      return { valid: true as const };
    }

    if (maxGames === 9 && minGames === 8) {
      if (!hasTiebreak) {
        return {
          valid: false as const,
          reason: "El 9-8 en set largo requiere tie-break",
        };
      }

      return validateTiebreak(tiebreakP1, tiebreakP2, 7);
    }

    return { valid: false as const, reason: "Set largo inválido" };
  }

  if (maxGames === 6 && minGames <= 4) {
    return { valid: true as const };
  }

  if (maxGames === 7 && minGames === 5) {
    return { valid: true as const };
  }

  if (maxGames === 7 && minGames === 6) {
    if (!hasTiebreak) {
      return {
        valid: false as const,
        reason: "El 7-6 requiere tie-break informado",
      };
    }

    return validateTiebreak(tiebreakP1, tiebreakP2, 7);
  }

  return { valid: false as const, reason: "Set corto inválido" };
}

function validateTiebreak(
  tiebreakP1: number | null | undefined,
  tiebreakP2: number | null | undefined,
  minWinnerScore: number,
) {
  if (tiebreakP1 == null || tiebreakP2 == null) {
    return { valid: false as const, reason: "Falta tie-break" };
  }

  if (tiebreakP1 === tiebreakP2) {
    return { valid: false as const, reason: "Tie-break inválido" };
  }

  const max = Math.max(tiebreakP1, tiebreakP2);
  const min = Math.min(tiebreakP1, tiebreakP2);

  if (max < minWinnerScore || max - min < 2) {
    return {
      valid: false as const,
      reason: "Tie-break requiere ganador mínimo y diferencia de 2",
    };
  }

  return { valid: true as const };
}

export function isValidMatchScore(
  sets: SetInput[],
  format: MatchFormat,
  isDraw: boolean,
) {
  if (format === "set_largo" && sets.length !== 1) {
    return {
      valid: false as const,
      reason: "Set largo requiere exactamente un set",
    };
  }

  if (format === "mr3" && (sets.length < 2 || sets.length > 3)) {
    return {
      valid: false as const,
      reason: "MR3 requiere entre 2 y 3 sets",
    };
  }

  for (const [index, set] of sets.entries()) {
    const result = isValidSet(set, {
      format,
      setNumber: (index + 1) as 1 | 2 | 3,
    });

    if (!result.valid) {
      return result;
    }
  }

  let setsP1 = 0;
  let setsP2 = 0;

  for (const set of sets) {
    if (set.gamesP1 > set.gamesP2) setsP1 += 1;
    if (set.gamesP2 > set.gamesP1) setsP2 += 1;
  }

  if (isDraw) {
    if (format === "set_largo") {
      return {
        valid: false as const,
        reason: "Empate en set largo no soportado en MVP",
      };
    }

    if (setsP1 === setsP2) {
      return { valid: true as const, winnerIndex: null };
    }

    return {
      valid: false as const,
      reason: "El score no corresponde a empate",
    };
  }

  if (setsP1 === setsP2) {
    return {
      valid: false as const,
      reason: "Falta desempatar el partido o marcar empate",
    };
  }

  return { valid: true as const, winnerIndex: setsP1 > setsP2 ? 1 : 2 };
}

export function calculateMatchPoints(outcome: MatchOutcome) {
  if (outcome.type === "draw") {
    return { both: 35 } as const;
  }

  if (outcome.type === "wo") {
    return { winner: 60, loser: -20 } as const;
  }

  if (outcome.format === "set_largo") {
    return { winner: 60, loser: 10 } as const;
  }

  return outcome.winnerWent3Sets
    ? ({ winner: 60, loser: 30 } as const)
    : ({ winner: 60, loser: 20 } as const);
}

export function calculateWinLossPoints(
  format: MatchFormat,
  winnerWent3Sets: boolean,
) {
  if (format === "set_largo") {
    return { winner: 60, loser: 10 } as const;
  }

  return winnerWent3Sets
    ? ({ winner: 60, loser: 30 } as const)
    : ({ winner: 60, loser: 20 } as const);
}

export function getLoserReason(format: MatchFormat, winnerWent3Sets: boolean) {
  if (format === "set_largo") {
    return "match_loss_set_largo" as const;
  }

  return winnerWent3Sets
    ? ("match_loss_3s" as const)
    : ("match_loss_2s" as const);
}
