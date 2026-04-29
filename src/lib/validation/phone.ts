import { z } from "zod";

export function cleanPhone(input: string): string {
  return input.replace(/[\s().-]/g, "");
}

export function normalizePhone(input: string): string {
  const cleaned = cleanPhone(input);

  if (cleaned.startsWith("+569") && cleaned.length === 12) {
    return cleaned;
  }

  if (cleaned.startsWith("569") && cleaned.length === 11) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("9") && cleaned.length === 9) {
    return `+56${cleaned}`;
  }

  return cleaned;
}

export const phoneSchema = z
  .string()
  .min(1, "Teléfono requerido")
  .transform(normalizePhone)
  .refine(
    (value) => /^\+569\d{8}$/.test(value),
    "Teléfono móvil chileno inválido (+569XXXXXXXX)",
  );

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace("+", "")}`;
}
