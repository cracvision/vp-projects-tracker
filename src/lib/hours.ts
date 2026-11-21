/**
 * HOURS-001 — Registro de horas por proyecto: validación, totales y formato.
 * Spec: docs/specs/HOURS-001_Horas.md
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ymdToLocalDate } from "@/lib/date";
import { sanitizeText } from "@/lib/validation";

/** Zona horaria del usuario (UTC−4, sin horario de verano). */
export const TIME_ZONE = "America/Puerto_Rico";
/** H-1: máximo de horas por entrada (lo garantiza también el CHECK de la base). */
export const MAX_HOURS = 24;
/** Tope de la nota (lo garantiza también el CHECK de la base). */
export const NOTES_MAX = 2000;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Fecha de hoy (YYYY-MM-DD) en Puerto Rico. */
export function todayYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** true si es YYYY-MM-DD y la fecha existe en el calendario (rechaza 2026-02-30). */
export function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** H-1: más de 0, máximo 24, hasta 2 decimales. Acepta coma o punto decimal. */
export function parseHours(input: string): Result<number> {
  const s = input.trim().replace(",", ".");
  if (!s) return { ok: false, error: "Escribe la cantidad de horas" };
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return { ok: false, error: "Escribe un número, p. ej. 7.5" };
  if ((s.split(".")[1] ?? "").length > 2) return { ok: false, error: "Usa como máximo 2 decimales" };
  const n = Number(s);
  if (!(n > 0)) return { ok: false, error: "Las horas deben ser más de 0" };
  if (n > MAX_HOURS) return { ok: false, error: `Máximo ${MAX_HOURS} horas por entrada` };
  return { ok: true, value: n };
}

/** H-3: hoy o cualquier día pasado; nunca futuro. `today` en YYYY-MM-DD (ver todayYmd). */
export function validateWorkDate(ymd: string, today: string): Result<string> {
  if (!ymd) return { ok: false, error: "Elige la fecha" };
  if (!isValidYmd(ymd)) return { ok: false, error: "Fecha no válida" };
  if (ymd > today) return { ok: false, error: "La fecha no puede ser futura" };
  return { ok: true, value: ymd };
}

/** Máximo de changelogs por entrada y largo de cada nombre (lo garantiza también el CHECK de la base). */
export const CHANGELOG_MAX_ITEMS = 10;
export const CHANGELOG_MAX_LEN = 255;

/** Una línea por archivo: recorta, quita vacías y duplicados (conserva el orden). */
export function parseChangelogRefs(input: string): Result<string[]> {
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const line of input.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    refs.push(t);
  }
  if (refs.length > CHANGELOG_MAX_ITEMS) return { ok: false, error: `Máximo ${CHANGELOG_MAX_ITEMS} changelogs por entrada` };
  if (refs.some((r) => r.length > CHANGELOG_MAX_LEN)) {
    return { ok: false, error: `Cada nombre puede tener como máximo ${CHANGELOG_MAX_LEN} caracteres` };
  }
  return { ok: true, value: refs };
}

export interface HourEntryForm {
  workDate: string;
  hours: string;
  notes: string;
  changelogs?: string;
}
export interface HourEntryValues {
  work_date: string;
  hours: number;
  notes: string | null;
  changelog_refs: string[];
}
export type HourEntryErrors = Partial<Record<"workDate" | "hours" | "changelogs", string>>;

/** Valida el formulario completo y devuelve los valores listos para la base, o los errores por campo. */
export function validateHourEntry(
  form: HourEntryForm,
  today: string,
): { ok: true; value: HourEntryValues } | { ok: false; errors: HourEntryErrors } {
  const date = validateWorkDate(form.workDate, today);
  const hours = parseHours(form.hours);
  const refs = parseChangelogRefs(form.changelogs ?? "");
  if (date.ok === false || hours.ok === false || refs.ok === false) {
    return {
      ok: false,
      errors: {
        ...(date.ok === false ? { workDate: date.error } : {}),
        ...(hours.ok === false ? { hours: hours.error } : {}),
        ...(refs.ok === false ? { changelogs: refs.error } : {}),
      },
    };
  }
  const notes = sanitizeText(form.notes, NOTES_MAX);
  return {
    ok: true,
    value: { work_date: date.value, hours: hours.value, notes: notes || null, changelog_refs: refs.value },
  };
}

/** Suma exacta (en centésimas, sin errores de coma flotante: 0.1 + 0.2 = 0.3). */
export function sumHours(values: number[]): number {
  return values.reduce((acc, h) => acc + Math.round(Number(h) * 100), 0) / 100;
}

const hoursFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
/** 8 → "8.0", 8.25 → "8.25", 1864.5 → "1,864.5" */
export function formatHours(n: number): string {
  return hoursFormat.format(n);
}

/** "20 nov 2026" */
export function formatDate(ymd: string): string {
  return format(ymdToLocalDate(ymd), "d MMM yyyy", { locale: es });
}
/** "viernes" */
export function formatWeekday(ymd: string): string {
  return format(ymdToLocalDate(ymd), "EEEE", { locale: es });
}
/** "viernes, 20 de noviembre 2026" (mismo formato que Trabajo Diario) */
export function formatDayLong(ymd: string): string {
  return format(ymdToLocalDate(ymd), "EEEE, d 'de' MMMM yyyy", { locale: es });
}

/** Mensaje en español para un error de Supabase al guardar o borrar. */
export function hoursErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  const msg = error?.message ?? "";
  if (msg.includes("hour_entries_hours_range") || error?.code === "22003") {
    return `Las horas deben ser más de 0 y como máximo ${MAX_HOURS}.`;
  }
  if (msg.includes("hour_entries_notes_length")) return `La nota no puede pasar de ${NOTES_MAX} caracteres.`;
  if (msg.includes("hour_entries_changelog_refs_valid")) {
    return `Changelog(s): máximo ${CHANGELOG_MAX_ITEMS} nombres de hasta ${CHANGELOG_MAX_LEN} caracteres.`;
  }
  if (error?.code === "23505" || msg.includes("hour_entries_owner_project_date_key")) {
    return "Ya existe una entrada para esta fecha en este proyecto.";
  }
  if (error?.code === "42501" || msg.includes("row-level security")) return "No tienes permiso para esta operación.";
  if (msg === "NOT_FOUND") return "La entrada ya no existe. Recarga la página.";
  return "No se pudo completar la operación. Intenta de nuevo.";
}
