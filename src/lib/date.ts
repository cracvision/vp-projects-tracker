// Trata YYYY-MM-DD como fecha *local* (evita salto al día anterior por huso horario)
export function ymdToLocalDate(ymd: string) {
  return new Date(`${ymd}T00:00:00`);
}
