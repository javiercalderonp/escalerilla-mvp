import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: "admin" | "player" | "guest";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "player" | "guest";
  }
}
