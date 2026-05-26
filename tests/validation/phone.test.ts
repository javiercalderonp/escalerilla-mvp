import { describe, expect, it } from "vitest";

import {
  cleanPhone,
  normalizePhone,
  phoneSchema,
  whatsappUrl,
} from "../../src/lib/validation/phone";

describe("phone validation", () => {
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

  it("schema acepta móviles chilenos y teléfonos internacionales E.164", () => {
    expect(phoneSchema.parse("912345678")).toBe("+56912345678");
    expect(phoneSchema.parse("+14155552671")).toBe("+14155552671");
    expect(() => phoneSchema.parse("+5621234567")).toThrow(
      "Teléfono inválido. Para Chile usa móvil +569XXXXXXXX",
    );
    expect(() => phoneSchema.parse("123")).toThrow(
      "Teléfono inválido. Para Chile usa móvil +569XXXXXXXX",
    );
  });

  it("arma url de WhatsApp", () => {
    expect(whatsappUrl("+56912345678")).toBe("https://wa.me/56912345678");
  });
});
