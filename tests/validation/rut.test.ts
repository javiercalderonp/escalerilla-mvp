import { describe, expect, it } from "vitest";

import {
  cleanRut,
  formatRut,
  isValidRut,
  rutSchema,
} from "../../src/lib/validation/rut";

describe("RUT validation", () => {
  it("limpia formato y normaliza K en mayúscula", () => {
    expect(cleanRut("12.345.678-k")).toBe("12345678K");
  });

  it("formatea con guion final", () => {
    expect(formatRut("123456785")).toBe("12345678-5");
    expect(formatRut("12.345.678-k")).toBe("12345678-K");
  });

  it("acepta RUTs válidos conocidos", () => {
    expect(isValidRut("12345678-5")).toBe(true);
    expect(isValidRut("11111111-1")).toBe(true);
    expect(isValidRut("76086428-5")).toBe(true);
  });

  it("rechaza DV incorrecto", () => {
    expect(isValidRut("12345678-9")).toBe(false);
  });

  it("rechaza formato inválido", () => {
    expect(isValidRut("123")).toBe(false);
    expect(isValidRut("ABC")).toBe(false);
  });

  it("schema transforma y valida", () => {
    expect(rutSchema.parse("12.345.678-5")).toBe("12345678-5");
    expect(() => rutSchema.parse("")).toThrow("RUT requerido");
    expect(() => rutSchema.parse("12.345.678-9")).toThrow("RUT inválido");
  });
});
