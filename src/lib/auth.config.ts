import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { env, isAdminEmail } from "@/lib/env";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const authConfig = {
  providers: [
    ...(env.googleClientId && env.googleClientSecret
      ? [
          Google({
            clientId: env.googleClientId,
            clientSecret: env.googleClientSecret,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !db) return null;

        const email = (credentials.email as string).toLowerCase();

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  trustHost: true,
  secret: env.authSecret || undefined,
  callbacks: {
    jwt({ token }) {
      if (!token.role) {
        token.role = isAdminEmail(token.email) ? "admin" : "player";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role =
          (token.role as "admin" | "player" | "guest") ?? "player";
        session.user.playerId = (token.playerId as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
