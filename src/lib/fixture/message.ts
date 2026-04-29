export type FixtureMatchEntry = {
  player1Name: string;
  player2Name: string;
};

export function buildFixtureMessage(
  weekLabel: string,
  matchesM: FixtureMatchEntry[],
  matchesF: FixtureMatchEntry[],
): string {
  const lines: string[] = [
    "🎾 *Escalerilla Club La Dehesa*",
    "",
    `*Fixture — semana ${weekLabel}*`,
    "",
  ];

  if (matchesM.length > 0) {
    lines.push("*Hombres*");
    matchesM.forEach((m, i) => {
      lines.push(`${i + 1}. ${m.player1Name} vs ${m.player2Name}`);
    });
    lines.push("");
  }

  if (matchesF.length > 0) {
    lines.push("*Mujeres*");
    matchesF.forEach((m, i) => {
      lines.push(`${i + 1}. ${m.player1Name} vs ${m.player2Name}`);
    });
    lines.push("");
  }

  lines.push("_¡Buena suerte a todos!_");

  return lines.join("\n");
}
