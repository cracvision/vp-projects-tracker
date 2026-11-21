import { describe, expect, it } from "vitest";
import {
  formatDate, formatDayLong, formatHours, formatWeekday, hoursErrorMessage, isValidYmd,
  parseHours, sumHours, todayYmd, validateHourEntry, validateWorkDate,
} from "./hours";

describe("todayYmd (Puerto Rico, UTC−4)", () => {
  it("a las 23:30 de PR sigue siendo el mismo día aunque en UTC ya sea el siguiente", () => {
    expect(todayYmd(new Date("2026-11-21T03:30:00Z"))).toBe("2026-11-20");
  });
  it("a medianoche de PR cambia de día", () => {
    expect(todayYmd(new Date("2026-11-21T04:00:00Z"))).toBe("2026-11-21");
  });
  it("sin horario de verano: en julio también es UTC−4", () => {
    expect(todayYmd(new Date("2026-07-01T03:59:00Z"))).toBe("2026-06-30");
  });
});

describe("isValidYmd", () => {
  it.each([["2026-11-20", true], ["2028-02-29", true], ["2026-02-29", false], ["2026-02-30", false],
    ["2026-13-01", false], ["2026-1-5", false], ["", false], ["20/11/2026", false]])("%s → %s", (ymd, ok) => {
    expect(isValidYmd(ymd)).toBe(ok);
  });
});

describe("parseHours (H-1)", () => {
  it.each([["8", 8], ["7.5", 7.5], ["8.25", 8.25], ["7,5", 7.5], [" 8 ", 8], [".5", 0.5], ["8.", 8],
    ["24", 24], ["0.01", 0.01]])("acepta %j → %d", (input, value) => {
    expect(parseHours(input)).toEqual({ ok: true, value });
  });
  it.each([
    ["", "Escribe la cantidad de horas"],
    ["   ", "Escribe la cantidad de horas"],
    ["abc", "Escribe un número, p. ej. 7.5"],
    ["-1", "Escribe un número, p. ej. 7.5"],
    ["1e2", "Escribe un número, p. ej. 7.5"],
    ["7.5.1", "Escribe un número, p. ej. 7.5"],
    ["8.255", "Usa como máximo 2 decimales"],
    ["0", "Las horas deben ser más de 0"],
    ["0.00", "Las horas deben ser más de 0"],
    ["24.01", "Máximo 24 horas por entrada"],
    ["100", "Máximo 24 horas por entrada"],
  ])("rechaza %j", (input, error) => {
    expect(parseHours(input)).toEqual({ ok: false, error });
  });
});

describe("validateWorkDate (H-3)", () => {
  const today = "2026-11-20";
  it("acepta hoy y cualquier fecha pasada", () => {
    expect(validateWorkDate(today, today)).toEqual({ ok: true, value: today });
    expect(validateWorkDate("2020-01-15", today)).toEqual({ ok: true, value: "2020-01-15" });
  });
  it("rechaza fechas futuras, vacías o inválidas", () => {
    expect(validateWorkDate("2026-11-21", today)).toEqual({ ok: false, error: "La fecha no puede ser futura" });
    expect(validateWorkDate("", today)).toEqual({ ok: false, error: "Elige la fecha" });
    expect(validateWorkDate("2026-02-30", today)).toEqual({ ok: false, error: "Fecha no válida" });
  });
});

describe("validateHourEntry", () => {
  const today = "2026-11-20";
  it("devuelve los valores listos para la base; nota vacía → null", () => {
    expect(validateHourEntry({ workDate: "2026-11-19", hours: "7,5", notes: "   " }, today)).toEqual({
      ok: true, value: { work_date: "2026-11-19", hours: 7.5, notes: null, changelog_refs: [] },
    });
  });
  it("limpia HTML de la nota y la recorta a 2000 caracteres", () => {
    const r = validateHourEntry({ workDate: today, hours: "1", notes: `<b>Hola</b> ${"x".repeat(2100)}` }, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.notes?.startsWith("Hola x")).toBe(true);
      expect(r.value.notes?.length).toBe(2000);
    }
  });
  it("junta los errores de los dos campos", () => {
    expect(validateHourEntry({ workDate: "2026-12-01", hours: "0", notes: "" }, today)).toEqual({
      ok: false, errors: { workDate: "La fecha no puede ser futura", hours: "Las horas deben ser más de 0" },
    });
    expect(validateHourEntry({ workDate: today, hours: "", notes: "" }, today)).toEqual({
      ok: false, errors: { hours: "Escribe la cantidad de horas" },
    });
  });
});

describe("sumHours", () => {
  it("suma exacta sin errores de coma flotante", () => {
    expect(sumHours([0.1, 0.2])).toBe(0.3);
    expect(sumHours([8.25, 7.5, 1.5])).toBe(17.25);
    expect(sumHours(Array(10).fill(0.01))).toBe(0.1);
  });
  it("lista vacía → 0", () => {
    expect(sumHours([])).toBe(0);
  });
});

describe("formato", () => {
  it("formatHours: al menos 1 decimal, máximo 2, con separador de miles", () => {
    expect(formatHours(8)).toBe("8.0");
    expect(formatHours(8.25)).toBe("8.25");
    expect(formatHours(7.5)).toBe("7.5");
    expect(formatHours(1864.5)).toBe("1,864.5");
  });
  it("fechas en español", () => {
    expect(formatDate("2026-11-20")).toBe("20 nov 2026");
    expect(formatWeekday("2026-11-20")).toBe("viernes");
    expect(formatDayLong("2026-11-20")).toBe("viernes, 20 de noviembre 2026");
  });
});

describe("hoursErrorMessage", () => {
  it("traduce los errores de la base", () => {
    expect(hoursErrorMessage({ code: "23514", message: 'violates check constraint "hour_entries_hours_range"' }))
      .toBe("Las horas deben ser más de 0 y como máximo 24.");
    expect(hoursErrorMessage({ code: "22003", message: "numeric field overflow" }))
      .toBe("Las horas deben ser más de 0 y como máximo 24.");
    expect(hoursErrorMessage({ message: 'violates check constraint "hour_entries_notes_length"' }))
      .toBe("La nota no puede pasar de 2000 caracteres.");
    expect(hoursErrorMessage({ code: "42501", message: "new row violates row-level security policy" }))
      .toBe("No tienes permiso para esta operación.");
    expect(hoursErrorMessage({ message: "NOT_FOUND" })).toBe("La entrada ya no existe. Recarga la página.");
    expect(hoursErrorMessage({ message: "Failed to fetch" })).toBe("No se pudo completar la operación. Intenta de nuevo.");
    expect(hoursErrorMessage(null)).toBe("No se pudo completar la operación. Intenta de nuevo.");
  });
});

describe("parseChangelogRefs", () => {
  it("trims, drops empty lines and duplicates", async () => {
    const { parseChangelogRefs } = await import("./hours");
    expect(parseChangelogRefs("  a.md \n\n b.md\na.md\n")).toEqual({ ok: true, value: ["a.md", "b.md"] });
    expect(parseChangelogRefs("")).toEqual({ ok: true, value: [] });
  });
  it("rejects more than 10 names or names over 255 chars", async () => {
    const { parseChangelogRefs } = await import("./hours");
    expect(parseChangelogRefs(Array.from({ length: 11 }, (_, i) => `f${i}`).join("\n")).ok).toBe(false);
    expect(parseChangelogRefs("x".repeat(256)).ok).toBe(false);
  });
});
