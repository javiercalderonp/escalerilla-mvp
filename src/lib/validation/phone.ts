import { z } from "zod";

export function cleanPhone(input: string): string {
  return input.replace(/[\s().-]/g, "");
}

export function normalizePhone(input: string): string {
  const cleaned = cleanPhone(input);

  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned;
  }

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
    (value) =>
      /^\+[1-9]\d{7,14}$/.test(value) &&
      (!value.startsWith("+56") || /^\+569\d{8}$/.test(value)),
    "Teléfono inválido. Para Chile usa móvil +569XXXXXXXX",
  );

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace("+", "")}`;
}
