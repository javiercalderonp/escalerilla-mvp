import { z } from "zod";

export function cleanRut(input: string): string {
  return input.replace(/[.\s-]/g, "").toUpperCase();
}

export function formatRut(input: string): string {
  const cleaned = cleanRut(input);

  if (cleaned.length < 2) {
    return cleaned;
  }

  return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`;
}

export function isValidRut(input: string): boolean {
  const cleaned = cleanRut(input);

  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) {
    return false;
  }

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  const expected = result === 11 ? "0" : result === 10 ? "K" : String(result);

  return expected === dv;
}

export const rutSchema = z
  .string()
  .min(1, "RUT requerido")
  .transform(formatRut)
  .refine(isValidRut, "RUT inválido");
