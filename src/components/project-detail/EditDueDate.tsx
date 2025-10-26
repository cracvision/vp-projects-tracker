import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface EditDueDateProps {
  projectId: string;
  value: string | null;       // yyyy-MM-dd o null
  onUpdated: () => void;      // para refrescar métricas/estado
}

export default function EditDueDate({ projectId, value, onUpdated }: EditDueDateProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function save(date: Date) {
    setLoading(true);
    try {
      const iso = format(date, "yyyy-MM-dd");
      const { error } = await supabase
        .from("projects")
        .update({ due_date: iso })
        .eq("id", projectId);
      if (error) throw error;
      toast({ title: "Fecha de entrega actualizada" });
      setOpen(false);
      onUpdated();
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar la fecha.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function clearDate() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ due_date: null })
        .eq("id", projectId);
      if (error) throw error;
      toast({ title: "Fecha de entrega eliminada" });
      setOpen(false);
      onUpdated();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar la fecha.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const label = value
    ? format(new Date(`${value}T00:00:00`), "d 'de' MMMM, yyyy", { locale: es })
    : "Sin fecha";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title="Editar fecha" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Selecciona la fecha</span>
          {value && (
            <Button variant="ghost" size="icon" title="Quitar fecha" onClick={clearDate} disabled={loading}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={value ? new Date(`${value}T00:00:00`) : undefined}
          onSelect={(d) => d && !loading && save(d)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
