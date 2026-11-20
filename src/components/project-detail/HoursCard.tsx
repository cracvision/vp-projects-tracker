import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import HourEntryDialog from "@/components/hours/HourEntryDialog";
import { useHourEntries } from "@/hooks/useHourEntries";
import { formatHours, sumHours } from "@/lib/hours";

interface Props {
  projectId: string;
  projectName: string;
}

/** HOURS-001 — Tarjeta "Horas" en la página del proyecto: total + "Entrar Horas" + "Ver Horas". */
export default function HoursCard({ projectId, projectName }: Props) {
  const navigate = useNavigate();
  const query = useHourEntries(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const entries = query.data ?? [];
  const total = sumHours(entries.map((e) => e.hours));

  return (
    <div className="bg-card rounded-lg border shadow-sm p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold">Horas</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {query.isPending
            ? "Cargando…"
            : query.isError
              ? "No se pudo cargar el total"
              : `Total registrado: ${formatHours(total)} h · ${entries.length} ${entries.length === 1 ? "entrada" : "entradas"}`}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Entrar Horas
        </Button>
        <Button variant="outline" onClick={() => navigate(`/project/${projectId}/hours`)}>
          <ListChecks className="h-4 w-4 mr-2" />
          Ver Horas
        </Button>
      </div>

      <HourEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        projectName={projectName}
      />
    </div>
  );
}
