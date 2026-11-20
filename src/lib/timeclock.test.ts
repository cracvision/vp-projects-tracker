import { describe, expect, it } from "vitest";
import {
  addDays,
  billableHours,
  decimalHours,
  formatHM,
  formatHMS,
  formatHours,
  fromLocal,
  isLongSession,
  localDate,
  localTime,
  presetRange,
  sessionTotals,
  summarize,
  validateSessionDraft,
  type TimedSession,
} from "./timeclock";

/** Instante en hora de Puerto Rico, p. ej. pr("2026-11-20 08:00"). */
const pr = (s: string) => `${s.replace(" ", "T")}:00-04:00`;
const hm = (h: number, m: number) => (h * 60 + m) * 60_000;

describe("§5 ejemplo de control (criterio 5)", () => {
  const session = {
    started_at: pr("2026-11-20 08:00"),
    ended_at: pr("2026-11-20 17:30"),
    breaks: [
      { started_at: pr("2026-11-20 12:00"), ended_at: pr("2026-11-20 12:45") },
      { started_at: pr("2026-11-20 15:00"), ended_at: pr("2026-11-20 15:10") },
    ],
  };

  it("bruto 9:30, pausas 0:55, neto 8:35 = 8.58 h, para facturar 8.5 h", () => {
    const t = sessionTotals(session);
    expect(formatHM(t.grossMs)).toBe("9:30");
    expect(formatHM(t.breakMs)).toBe("0:55");
    expect(formatHM(t.netMs)).toBe("8:35");
    expect(decimalHours(t.netMs)).toBe(8.58);
    expect(billableHours(t.netMs)).toBe(8.5);
    expect(formatHours(billableHours(t.netMs))).toBe("8.50");
  });

  it("una sesión cerrada no depende de 'ahora'", () => {
    expect(sessionTotals(session, pr("2030-01-01 00:00")).netMs).toBe(hm(8, 35));
  });
});

describe("sesión abierta: el cronómetro cuenta hasta ahora (criterios 3 y 6)", () => {
  const open = { started_at: pr("2026-11-20 08:00"), ended_at: null, breaks: [] };

  it("sin pausas", () => {
    expect(formatHMS(sessionTotals(open, pr("2026-11-20 10:30")).netMs)).toBe("2:30:00");
  });

  it("con una pausa abierta, el tiempo en pausa no cuenta", () => {
    const s = { ...open, breaks: [{ started_at: pr("2026-11-20 10:00"), ended_at: null }] };
    const t = sessionTotals(s, pr("2026-11-20 10:30"));
    expect(formatHMS(t.netMs)).toBe("2:00:00");
    expect(formatHMS(t.breakMs)).toBe("0:30:00");
  });

  it("al terminar la pausa, el cronómetro sigue desde donde estaba", () => {
    const s = { ...open, breaks: [{ started_at: pr("2026-11-20 10:00"), ended_at: pr("2026-11-20 10:15") }] };
    expect(formatHMS(sessionTotals(s, pr("2026-11-20 11:00")).netMs)).toBe("2:45:00");
  });

  it("acepta las marcas de tiempo de Postgres con microsegundos", () => {
    const s = { started_at: "2026-11-20T12:00:00.123456+00:00", ended_at: "2026-11-20T13:00:00.123456+00:00" };
    expect(sessionTotals(s).netMs).toBe(hm(1, 0));
  });
});

describe("formato y redondeo (D-4)", () => {
  it("h:mm usa minutos completos y h:mm:ss segundos completos", () => {
    expect(formatHM(hm(8, 35) + 59_000)).toBe("8:35");
    expect(formatHM(0)).toBe("0:00");
    expect(formatHM(hm(25, 5))).toBe("25:05");
    expect(formatHMS(hm(1, 2) + 3_999)).toBe("1:02:03");
  });

  it("decimal con 2 decimales", () => {
    expect(decimalHours(hm(8, 20))).toBe(8.33);
    expect(decimalHours(hm(8, 40))).toBe(8.67);
    expect(decimalHours(hm(0, 0))).toBe(0);
  });

  it.each([
    [hm(8, 14) + 59_000, 8],
    [hm(8, 15), 8.5],
    [hm(8, 44), 8.5],
    [hm(8, 45), 9],
    [hm(0, 14), 0],
    [hm(0, 15), 0.5],
  ])("para facturar al 0.5 h más cercano: %i ms → %d h", (ms, expected) => {
    expect(billableHours(ms)).toBe(expected);
  });
});

describe("zona horaria de Puerto Rico (D-5)", () => {
  it("la fecha local no es la de UTC", () => {
    expect(localDate("2026-11-20T03:30:00Z")).toBe("2026-11-19"); // 23:30 en PR
    expect(localDate("2026-11-20T04:00:00Z")).toBe("2026-11-20"); // 00:00 en PR
    expect(localTime("2026-11-20T04:00:00Z")).toBe("00:00");
    expect(localTime("2026-11-20T21:45:00Z")).toBe("17:45");
  });

  it("una sesión que cruza medianoche cuenta para el día de entrada", () => {
    expect(localDate(fromLocal("2026-11-18", "22:00"))).toBe("2026-11-18");
  });

  it("fromLocal convierte hora de PR a UTC y vuelve igual", () => {
    const iso = fromLocal("2026-11-20", "08:00");
    expect(iso).toBe("2026-11-20T12:00:00.000Z");
    expect(localDate(iso)).toBe("2026-11-20");
    expect(localTime(iso)).toBe("08:00");
  });

  it("fromLocal rechaza fechas u horas inválidas", () => {
    expect(() => fromLocal("2026-02-30", "08:00")).toThrow();
    expect(() => fromLocal("2026-11-20", "8:00")).toThrow();
    expect(() => fromLocal("20/11/2026", "08:00")).toThrow();
  });
});

describe("presets del historial", () => {
  const friday = pr("2026-11-20 10:00");

  it("Hoy, Semana (desde el lunes) y Mes", () => {
    expect(presetRange("today", friday)).toEqual({ from: "2026-11-20", to: "2026-11-20" });
    expect(presetRange("week", friday)).toEqual({ from: "2026-11-16", to: "2026-11-20" });
    expect(presetRange("month", friday)).toEqual({ from: "2026-11-01", to: "2026-11-20" });
  });

  it("el domingo pertenece a la semana que empezó el lunes anterior", () => {
    expect(presetRange("week", pr("2026-11-22 09:00"))).toEqual({ from: "2026-11-16", to: "2026-11-22" });
  });

  it("usa el día de PR aunque en UTC ya sea mañana", () => {
    expect(presetRange("today", "2026-11-21T02:00:00Z")).toEqual({ from: "2026-11-20", to: "2026-11-20" });
  });

  it("addDays cruza meses y años", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("totales del historial (criterio 9, D-4 por día y proyecto)", () => {
  const session = (date: string, project: string, from: string, to: string): TimedSession => ({
    work_date: date,
    project_id: project,
    started_at: pr(`${date} ${from}`),
    ended_at: pr(`${date} ${to}`),
    breaks: [],
  });

  it("dos sesiones de 1:10 del mismo día y proyecto: 2:20 → 2.5 h (no 1.0 + 1.0)", () => {
    const s = summarize([session("2026-11-20", "P1", "08:00", "09:10"), session("2026-11-20", "P1", "14:00", "15:10")]);
    expect(s.dayProject).toHaveLength(1);
    expect(formatHM(s.dayProject[0].netMs)).toBe("2:20");
    expect(s.dayProject[0].billable).toBe(2.5);
    expect(s.totalBillable).toBe(2.5);
  });

  it("dos proyectos el mismo día se redondean por separado y se suman", () => {
    const s = summarize([session("2026-11-20", "P1", "08:00", "09:10"), session("2026-11-20", "P2", "10:00", "11:20")]);
    expect(s.days).toEqual([{ work_date: "2026-11-20", netMs: hm(2, 30), billable: 2.5 }]); // 1.0 + 1.5
  });

  it("totales por día, por proyecto y del rango; días en orden descendente", () => {
    const s = summarize([
      session("2026-11-18", "P1", "08:00", "12:00"),
      session("2026-11-20", "P1", "08:00", "09:00"),
      session("2026-11-20", "P2", "09:00", "11:30"),
      session("2026-11-19", "P2", "13:00", "13:20"),
    ]);
    expect(s.days.map((d) => d.work_date)).toEqual(["2026-11-20", "2026-11-19", "2026-11-18"]);
    expect(s.days.map((d) => d.billable)).toEqual([3.5, 0.5, 4]);
    const byProject = Object.fromEntries(s.projects.map((p) => [p.project_id, p]));
    expect(byProject.P1).toEqual({ project_id: "P1", netMs: hm(5, 0), billable: 5 });
    expect(byProject.P2).toEqual({ project_id: "P2", netMs: hm(2, 50), billable: 3 });
    expect(formatHM(s.totalNetMs)).toBe("7:50");
    expect(s.totalBillable).toBe(8);
  });

  it("una sesión abierta suma hasta ahora", () => {
    const open = { ...session("2026-11-20", "P1", "08:00", "08:00"), ended_at: null };
    expect(summarize([open], pr("2026-11-20 09:30")).totalNetMs).toBe(hm(1, 30));
  });

  it("sin sesiones, todo en cero", () => {
    expect(summarize([])).toEqual({ dayProject: [], days: [], projects: [], totalNetMs: 0, totalBillable: 0 });
  });
});

describe("aviso de sesión larga (D-6)", () => {
  const open = { started_at: pr("2026-11-20 08:00"), ended_at: null };

  it("abierta: avisa a partir de 12 h", () => {
    expect(isLongSession(open, pr("2026-11-20 20:00"))).toBe(false);
    expect(isLongSession(open, pr("2026-11-20 20:01"))).toBe(true);
  });

  it("cerrada (diálogo manual): avisa si dura más de 12 h", () => {
    expect(isLongSession({ ...open, ended_at: pr("2026-11-20 20:00") })).toBe(false);
    expect(isLongSession({ ...open, ended_at: pr("2026-11-21 09:00") })).toBe(true);
  });
});

describe("validación del diálogo (mismos mensajes que la base)", () => {
  const now = pr("2026-11-20 18:00");
  const base = { started_at: pr("2026-11-20 08:00"), ended_at: pr("2026-11-20 17:00") };
  const brk = (from: string, to: string | null) => ({
    started_at: pr(`2026-11-20 ${from}`),
    ended_at: to ? pr(`2026-11-20 ${to}`) : null,
  });

  it("acepta una sesión válida con pausas, y pausas que se tocan sin solaparse", () => {
    expect(validateSessionDraft({ ...base, breaks: [brk("12:00", "12:30"), brk("12:30", "12:45")] }, now)).toBeNull();
  });

  it("acepta una sesión abierta con una pausa abierta", () => {
    expect(validateSessionDraft({ started_at: base.started_at, ended_at: null, breaks: [brk("12:00", null)] }, now)).toBeNull();
  });

  it.each([
    ["salida antes de la entrada", { ...base, ended_at: pr("2026-11-20 07:00"), breaks: [] }, "La salida debe ser posterior a la entrada"],
    ["entrada en el futuro", { started_at: pr("2026-11-20 19:00"), ended_at: null, breaks: [] }, "La entrada no puede estar en el futuro"],
    ["salida en el futuro", { ...base, ended_at: pr("2026-11-20 19:00"), breaks: [] }, "La salida no puede estar en el futuro"],
    ["pausa con fin antes del inicio", { ...base, breaks: [brk("12:30", "12:00")] }, "El fin de la pausa debe ser posterior a su inicio"],
    ["pausa antes de la entrada", { ...base, breaks: [brk("07:00", "07:30")] }, "La pausa no puede empezar antes de la entrada"],
    ["pausa después de la salida", { ...base, breaks: [brk("16:30", "17:30")] }, "La pausa debe terminar antes de la salida"],
    ["pausa abierta en sesión cerrada", { ...base, breaks: [brk("16:30", null)] }, "La pausa debe terminar antes de la salida"],
    ["pausas solapadas", { ...base, breaks: [brk("12:00", "12:45"), brk("12:30", "13:00")] }, "La pausa se solapa con otra pausa"],
    ["dos pausas abiertas", { started_at: base.started_at, ended_at: null, breaks: [brk("12:00", null), brk("13:00", null)] }, "La pausa se solapa con otra pausa"],
  ])("rechaza %s", (_label, draft, message) => {
    expect(validateSessionDraft(draft, now)).toBe(message);
  });
});
