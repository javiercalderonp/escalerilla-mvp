type ResolveUserRoleInput = {
  isConfiguredAdmin: boolean;
  currentRole?: "admin" | "player" | "guest" | null;
  hasLinkedPlayer: boolean;
};

export function resolveUserRole({
  isConfiguredAdmin,
  currentRole,
  hasLinkedPlayer,
}: ResolveUserRoleInput): "admin" | "player" | "guest" {
  if (isConfiguredAdmin || currentRole === "admin") {
    return "admin";
  }

  return hasLinkedPlayer ? "player" : "guest";
}
