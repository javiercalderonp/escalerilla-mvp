import { describe, expect, it } from "vitest";

import {
  cleanPhone,
  normalizePhone,
  phoneSchema,
  whatsappUrl,
} from "../../src/lib/validation/phone";

describe("CL phone validation", () => {
  it("limpia separadores comunes", () => {
    expect(cleanPhone("9 1234 5678")).toBe("912345678");
    expect(cleanPhone("(+56) 9 1234-5678")).toBe("+56912345678");
  });

  it("normaliza formatos válidos a E.164 chileno", () => {
    expect(normalizePhone("+56912345678")).toBe("+56912345678");
    expect(normalizePhone("56912345678")).toBe("+56912345678");
    expect(normalizePhone("912345678")).toBe("+56912345678");
    expect(normalizePhone("9 1234 5678")).toBe("+56912345678");
  });

  it("schema acepta móviles chilenos y rechaza otros formatos", () => {
    expect(phoneSchema.parse("912345678")).toBe("+56912345678");
    expect(() => phoneSchema.parse("+1234567890")).toThrow(
      "Teléfono móvil chileno inválido (+569XXXXXXXX)",
    );
    expect(() => phoneSchema.parse("+5621234567")).toThrow(
      "Teléfono móvil chileno inválido (+569XXXXXXXX)",
    );
    expect(() => phoneSchema.parse("123")).toThrow(
      "Teléfono móvil chileno inválido (+569XXXXXXXX)",
    );
  });

  it("arma url de WhatsApp", () => {
    expect(whatsappUrl("+56912345678")).toBe("https://wa.me/56912345678");
  });
});
