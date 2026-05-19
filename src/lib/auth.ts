import { eq } from "drizzle-orm";
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/env";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (trigger === "signIn" && user?.email && db) {
        const email = user.email.toLowerCase();

        const existing = await db
          .select({ id: users.id, playerId: users.playerId, role: users.role })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing.length === 0) {
          const roleValue = isAdminEmail(email) ? "admin" : "guest";
          const [created] = await db
            .insert(users)
            .values({
              email,
              name: user.name ?? null,
              image: user.image ?? null,
              role: roleValue,
              lastLoginAt: new Date(),
            })
            .returning({ id: users.id, playerId: users.playerId });

          token.playerId = created?.playerId ?? null;
          token.role = roleValue;
        } else {
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.email, email));

          token.playerId = existing[0].playerId ?? null;
          token.role = isAdminEmail(email) ? "admin" : existing[0].role;
        }
      } else {
        token.role = isAdminEmail(token.email)
          ? "admin"
          : (token.role ?? "player");
      }

      if (trigger === "update" && session && typeof session === "object") {
        const u = (session as { user?: Record<string, unknown> }).user;
        if (u && "playerId" in u) {
          token.playerId = u.playerId as string | null;
        }
      }

      return token;
    },
  },
});
