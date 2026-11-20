import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type HourEntry, useSaveHourEntry } from "@/hooks/useHourEntries";
import {
  type HourEntryErrors, NOTES_MAX, formatDate, formatDayLong, formatHours, hoursErrorMessage,
  isValidYmd, todayYmd, validateHourEntry,
} from "@/lib/hours";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  /** Con entrada: modo editar. Sin entrada: "Entrar Horas". */
  entry?: HourEntry | null;
}

/** HOURS-001 — Diálogo "Entrar Horas" / "Editar horas": fecha + horas + nota opcional. */
export default function HourEntryDialog({ open, onOpenChange, projectId, projectName, entry }: Props) {
  const { toast } = useToast();
  const save = useSaveHourEntry(projectId);
  const [today, setToday] = useState(() => todayYmd());
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<HourEntryErrors>({});

  // Cada vez que se abre: datos de la entrada (editar) o vacío con la fecha de hoy (nuevo)
  useEffect(() => {
    if (!open) return;
    const now = todayYmd();
    setToday(now);
    setWorkDate(entry?.work_date ?? now);
    setHours(entry ? String(entry.hours) : "");
    setNotes(entry?.notes ?? "");
    setErrors({});
  }, [open, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateHourEntry({ workDate, hours, notes }, todayYmd());
    if (result.ok === false) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync({ id: entry?.id, values: result.value });
      toast({
        title: entry ? "Entrada actualizada" : "Horas registradas",
        description: `${formatHours(result.value.hours)} h · ${formatDate(result.value.work_date)}`,
      });
      onOpenChange(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Hour entry save error:", err);
      toast({ title: "Error", description: hoursErrorMessage(err as { code?: string; message?: string }), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar horas" : "Entrar Horas"}</DialogTitle>
          {projectName && <DialogDescription>{projectName}</DialogDescription>}
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hour-entry-date">Fecha *</Label>
            <Input
              id="hour-entry-date"
              type="date"
              value={workDate}
              max={today}
              onChange={(e) => setWorkDate(e.target.value)}
              aria-invalid={!!errors.workDate}
            />
            {isValidYmd(workDate) && (
              <p className="text-sm text-muted-foreground first-letter:uppercase">{formatDayLong(workDate)}</p>
            )}
            {errors.workDate && <p className="text-sm text-destructive">{errors.workDate}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hour-entry-hours">Horas *</Label>
            <Input
              id="hour-entry-hours"
              inputMode="decimal"
              autoComplete="off"
              placeholder="8.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-invalid={!!errors.hours}
              autoFocus
            />
            {errors.hours && <p className="text-sm text-destructive">{errors.hours}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hour-entry-notes">Nota</Label>
            <Textarea
              id="hour-entry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={NOTES_MAX}
              rows={3}
              placeholder="Opcional"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
