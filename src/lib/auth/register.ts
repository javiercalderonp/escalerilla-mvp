"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/env";

const RegisterSchema = z
  .object({
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z
      .string()
      .min(8, "La confirmación debe tener al menos 8 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterResult =
  | { success: true }
  | { success: false; error: string };

export async function registerWithEmail(
  formData: FormData,
): Promise<RegisterResult> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError?.message ?? "Datos inválidos" };
  }

  const { email: rawEmail, password } = parsed.data;
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
    return {
      success: false,
      error: "Este email ya está asociado a una cuenta de Google",
    };
  }

  const passwordHash = await hash(password, 12);

  await db.insert(users).values({
    email,
    passwordHash,
    role: isAdminEmail(email) ? "admin" : "guest",
    lastLoginAt: new Date(),
  });

  return { success: true };
}
