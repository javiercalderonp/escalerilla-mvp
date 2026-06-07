import { describe, expect, it } from "vitest";

import { buildFixtureMessage } from "../message";

describe("buildFixtureMessage", () => {
  it("renders the club name and short week label for WhatsApp", () => {
    expect(
      buildFixtureMessage(
        "1 de junio",
        [{ player1Name: "Ana Perez", player2Name: "Beatriz Soto" }],
        [],
      ),
    ).toBe(
      [
        "🎾 *Escalerilla Club De Golf La Dehesa*",
        "",
        "*Fixture — semana 1 de junio*",
        "",
        "*Hombres*",
        "1. Ana Perez vs Beatriz Soto",
        "",
        "_¡Buena suerte a todos!_",
      ].join("\n"),
    );
  });
});
