import { describe, expect, it } from "vitest";

import { resolveUserRole } from "../role";

describe("resolveUserRole", () => {
  it("preserves an admin promoted in the database", () => {
    expect(
      resolveUserRole({
        isConfiguredAdmin: false,
        currentRole: "admin",
        hasLinkedPlayer: true,
      }),
    ).toBe("admin");
  });

  it("grants admin to emails configured in the environment", () => {
    expect(
      resolveUserRole({
        isConfiguredAdmin: true,
        currentRole: "guest",
        hasLinkedPlayer: false,
      }),
    ).toBe("admin");
  });

  it("derives non-admin roles from the linked player", () => {
    expect(
      resolveUserRole({
        isConfiguredAdmin: false,
        currentRole: "guest",
        hasLinkedPlayer: true,
      }),
    ).toBe("player");
    expect(
      resolveUserRole({
        isConfiguredAdmin: false,
        currentRole: "player",
        hasLinkedPlayer: false,
      }),
    ).toBe("guest");
  });
});
