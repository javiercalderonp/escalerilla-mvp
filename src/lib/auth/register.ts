"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/env";

const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
});

export type RegisterResult =
  | { success: true }
  | { success: false; error: string };

export async function registerWithEmail(formData: FormData): Promise<RegisterResult> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError?.message ?? "Datos inválidos" };
  }

  const { email: rawEmail, password, name } = parsed.data;
  const email = rawEmail.toLowerCase();

  if (!db) return { success: false, error: "Error de base de datos" };

  const [existing] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (existing.passwordHash) {
      return { success: false, error: "Ya existe una cuenta con este email" };
    }
    return { success: false, error: "Este email ya está asociado a una cuenta de Google" };
  }

  const passwordHash = await hash(password, 12);

  await db.insert(users).values({
    email,
    name,
    passwordHash,
    role: isAdminEmail(email) ? "admin" : "guest",
    lastLoginAt: new Date(),
  });

  return { success: true };
}
