export type ChallengeViolation =
  | { code: "RN-06"; rankDiff: number }
  | { code: "RN-03" };

export function checkChallengeEligibility(
  rankA: number,
  rankB: number,
  daysSinceLastMatch: number | null,
): ChallengeViolation[] {
  const violations: ChallengeViolation[] = [];

  const diff = Math.abs(rankA - rankB);
  if (diff > 5) {
    violations.push({ code: "RN-06", rankDiff: diff });
  }

  if (daysSinceLastMatch !== null && daysSinceLastMatch < 30) {
    violations.push({ code: "RN-03" });
  }

  return violations;
}

export function formatViolations(violations: ChallengeViolation[]): string {
  return violations
    .map((v) => {
      if (v.code === "RN-06") {
        return `RN-06: diferencia de posición ${v.rankDiff} supera el límite de 5`;
      }
      return "RN-03: estos jugadores ya se enfrentaron en los últimos 30 días";
    })
    .join(". ");
}
