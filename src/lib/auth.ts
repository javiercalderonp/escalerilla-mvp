import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { env, isAdminEmail } from "@/lib/env";

export const authConfig = {
  providers:
    env.googleClientId && env.googleClientSecret
      ? [
          Google({
            clientId: env.googleClientId,
            clientSecret: env.googleClientSecret,
          }),
        ]
      : [],
  trustHost: true,
  secret: env.authSecret || undefined,
  callbacks: {
    jwt({ token }) {
      const role = isAdminEmail(token.email) ? "admin" : "guest";
      token.role = token.role ?? role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role =
          (token.role as "admin" | "player" | "guest") ?? "guest";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
