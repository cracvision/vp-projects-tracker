/**
 * TIME-CLOCK-001 — Lógica pura de la página "Ponchar" (sin React ni Supabase).
 * Spec: docs/specs/TIME-CLOCK-001_Ponchar.md — §5 (cálculo), §3 D-4 / D-5 / D-6 y §3.1.
 *
 * Las horas viajan como ISO 8601 (lo que devuelve Supabase para timestamptz). Todo lo que depende del día o la
 * hora local usa la zona de Puerto Rico, nunca la del navegador.
 */

/** D-5: zona horaria del usuario. Puerto Rico no tiene horario de verano: siempre UTC−4. */
export const TIME_ZONE = "America/Puerto_Rico";
export const TIME_ZONE_OFFSET = "-04:00";

/** D-6: aviso si una sesión lleva abierta (o dura, en el diálogo manual) más de estas horas. */
export const LONG_SESSION_HOURS = 12;

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

export type Instant = string | number | Date;

export interface BreakInterval {
  started_at: string;
  ended_at: string | null;
}

export interface SessionInterval {
  started_at: string;
  ended_at: string | null;
  breaks?: BreakInterval[] | null;
}

export interface SessionTotals {
  grossMs: number;
  breakMs: number;
  netMs: number;
}

export function toMs(t: Instant): number {
  const ms = t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t);
  if (Number.isNaN(ms)) throw new Error(`Fecha inválida: ${String(t)}`);
  return ms;
}

// ── Cálculo (§5) ────────────────────────────────────────────────────────────

/**
 * bruto = (salida ?? ahora) − entrada · pausas = Σ (fin ?? ahora) − inicio · neto = bruto − pausas.
 * Las pausas se recortan a los límites de la sesión por seguridad (la base ya lo garantiza).
 */
export function sessionTotals(session: SessionInterval, now: Instant = Date.now()): SessionTotals {
  const nowMs = toMs(now);
  const start = toMs(session.started_at);
  const end = session.ended_at ? toMs(session.ended_at) : nowMs;
  const grossMs = Math.max(0, end - start);

  let breakMs = 0;
  for (const b of session.breaks ?? []) {
    const bStart = Math.max(toMs(b.started_at), start);
    const bEnd = Math.min(b.ended_at ? toMs(b.ended_at) : nowMs, end);
    if (bEnd > bStart) breakMs += bEnd - bStart;
  }

  return { grossMs, breakMs, netMs: Math.max(0, grossMs - breakMs) };
}

// ── Formato y redondeo (§5, D-4) ────────────────────────────────────────────

/** "h:mm" con minutos completos, como un reloj: 8 h 35 min 59 s → "8:35". */
export function formatHM(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / MS_PER_MINUTE);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** "h:mm:ss" para el cronómetro en vivo. */
export function formatHMS(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / MS_PER_SECOND);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Horas en decimal con 2 decimales: 8:35 → 8.58. */
export function decimalHours(ms: number): number {
  return Math.round(Math.max(0, ms) / (MS_PER_HOUR / 100)) / 100;
}

/** D-4 "para facturar": al 0.5 h más cercano (8:14 → 8.0 · 8:15 → 8.5 · 8:45 → 9.0). */
export function billableHours(ms: number): number {
  return Math.round(Math.max(0, ms) / (MS_PER_HOUR / 2)) / 2;
}

/** Horas para mostrar con 2 decimales: 8.5 → "8.50". */
export function formatHours(hours: number): string {
  return hours.toFixed(2);
}

// ── Zona horaria de Puerto Rico (D-5) ───────────────────────────────────────

const localParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(t: Instant): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const { type, value } of localParts.formatToParts(new Date(toMs(t)))) parts[type] = value;
  return parts;
}

/** Fecha local "YYYY-MM-DD". Misma regla que la columna work_date de la base. */
export function localDate(t: Instant): string {
  const p = partsOf(t);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hora local "HH:mm" (00–23). */
export function localTime(t: Instant): string {
  const p = partsOf(t);
  return `${p.hour}:${p.minute}`;
}

/** Fecha y hora locales ("2026-11-20", "08:00") → ISO UTC para guardar ("2026-11-20T12:00:00.000Z"). */
export function fromLocal(dateYmd: string, timeHm: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !/^\d{2}:\d{2}$/.test(timeHm)) {
    throw new Error("Fecha u hora con formato inválido");
  }
  const d = new Date(`${dateYmd}T${timeHm}:00${TIME_ZONE_OFFSET}`);
  if (Number.isNaN(d.getTime()) || localDate(d) !== dateYmd) throw new Error("Fecha u hora inválida");
  return d.toISOString();
}

/** Suma días a una fecha "YYYY-MM-DD" (aritmética de calendario, sin zona horaria). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type RangePreset = "today" | "week" | "month";

/** Presets del historial en días locales de Puerto Rico. La semana empieza el lunes, como en Entradas. */
export function presetRange(preset: RangePreset, now: Instant = Date.now()): { from: string; to: string } {
  const today = localDate(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") {
    const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = domingo
    return { from: addDays(today, -((dayOfWeek + 6) % 7)), to: today };
  }
  return { from: `${today.slice(0, 8)}01`, to: today };
}

// ── Totales del historial (§6, D-4 por día y proyecto) ──────────────────────

export interface TimedSession extends SessionInterval {
  project_id: string;
  work_date: string;
}

export interface DayProjectTotal {
  work_date: string;
  project_id: string;
  netMs: number;
  billable: number;
}

export interface Summary {
  /** Neto y "para facturar" por día y proyecto; fecha descendente. */
  dayProject: DayProjectTotal[];
  /** Por día; "para facturar" = suma de lo redondeado por proyecto ese día. Fecha descendente. */
  days: { work_date: string; netMs: number; billable: number }[];
  /** Por proyecto en todo el rango. */
  projects: { project_id: string; netMs: number; billable: number }[];
  totalNetMs: number;
  totalBillable: number;
}

/**
 * D-4 (§3.1): el redondeo "para facturar" se aplica al total de cada día y proyecto, no a cada sesión.
 * Dos sesiones de 1:10 el mismo día y proyecto suman 2:20 → 2.5 h (no 1.0 + 1.0).
 */
export function summarize(sessions: TimedSession[], now: Instant = Date.now()): Summary {
  const byKey = new Map<string, DayProjectTotal>();
  for (const s of sessions) {
    const key = `${s.work_date}|${s.project_id}`;
    const row = byKey.get(key) ?? { work_date: s.work_date, project_id: s.project_id, netMs: 0, billable: 0 };
    row.netMs += sessionTotals(s, now).netMs;
    byKey.set(key, row);
  }

  const dayProject = [...byKey.values()]
    .map((r) => ({ ...r, billable: billableHours(r.netMs) }))
    .sort((a, b) => b.work_date.localeCompare(a.work_date) || a.project_id.localeCompare(b.project_id));

  const days = new Map<string, { work_date: string; netMs: number; billable: number }>();
  const projects = new Map<string, { project_id: string; netMs: number; billable: number }>();
  for (const r of dayProject) {
    const d = days.get(r.work_date) ?? { work_date: r.work_date, netMs: 0, billable: 0 };
    d.netMs += r.netMs;
    d.billable += r.billable;
    days.set(r.work_date, d);

    const p = projects.get(r.project_id) ?? { project_id: r.project_id, netMs: 0, billable: 0 };
    p.netMs += r.netMs;
    p.billable += r.billable;
    projects.set(r.project_id, p);
  }

  return {
    dayProject,
    days: [...days.values()],
    projects: [...projects.values()],
    totalNetMs: dayProject.reduce((sum, r) => sum + r.netMs, 0),
    totalBillable: dayProject.reduce((sum, r) => sum + r.billable, 0),
  };
}

// ── Avisos y validación ─────────────────────────────────────────────────────

/**
 * D-6: true si la sesión supera LONG_SESSION_HOURS. Abierta: desde la entrada hasta ahora
 * ("¿Olvidaste ponchar la salida?"). Cerrada (diálogo manual): de entrada a salida.
 */
export function isLongSession(session: SessionInterval, now: Instant = Date.now()): boolean {
  return sessionTotals(session, now).grossMs > LONG_SESSION_HOURS * MS_PER_HOUR;
}

export interface SessionDraft {
  started_at: string;
  ended_at: string | null;
  breaks: BreakInterval[];
}

/**
 * Validación del diálogo antes de guardar. Repite las reglas de la base (validate_time_session y
 * validate_time_break) con sus mismos mensajes, y añade una de pantalla: nada en el futuro (1 min de margen
 * por relojes desfasados). Devuelve el primer error o null. La base sigue siendo la que decide.
 */
export function validateSessionDraft(draft: SessionDraft, now: Instant = Date.now()): string | null {
  const limit = toMs(now) + MS_PER_MINUTE;
  const start = toMs(draft.started_at);
  const end = draft.ended_at ? toMs(draft.ended_at) : null;

  if (start > limit) return "La entrada no puede estar en el futuro";
  if (end !== null && end <= start) return "La salida debe ser posterior a la entrada";
  if (end !== null && end > limit) return "La salida no puede estar en el futuro";

  const breaks = draft.breaks
    .map((b) => ({ start: toMs(b.started_at), end: b.ended_at ? toMs(b.ended_at) : null }))
    .sort((a, b) => a.start - b.start);

  for (const b of breaks) {
    if (b.end !== null && b.end <= b.start) return "El fin de la pausa debe ser posterior a su inicio";
    if (b.start < start) return "La pausa no puede empezar antes de la entrada";
    if (end !== null && (b.end === null || b.end > end)) return "La pausa debe terminar antes de la salida";
    if (b.start > limit) return "La pausa no puede estar en el futuro";
  }
  // Intervalos [inicio, fin): una pausa que empieza justo cuando termina otra no se solapa (igual que tstzrange).
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i].start < (breaks[i - 1].end ?? Infinity)) return "La pausa se solapa con otra pausa";
  }
  return null;
}
