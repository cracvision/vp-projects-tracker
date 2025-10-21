import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DailyEntry {
  id: string;
  hours: number;
  notes: string | null;
  created_at: string;
  tasks: { name: string } | null;
}

interface DailyEntriesListProps {
  projectId: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  refreshKey: number;
  onEntryDeleted: () => void;
}

const DailyEntriesList = ({
  projectId,
  selectedDate,
  onDateChange,
  refreshKey,
  onEntryDeleted,
}: DailyEntriesListProps) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    fetchEntries();
  }, [projectId, selectedDate, refreshKey]);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("daily_entries")
        .select("*, tasks(name)")
        .eq("project_id", projectId)
        .eq("date_iso", selectedDate)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setEntries(data || []);
      const total = (data || []).reduce((sum, entry) => sum + entry.hours, 0);
      setTotalHours(total);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las entradas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("daily_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      toast({
        title: "Entrada eliminada",
        description: "La entrada se ha eliminado correctamente",
      });
      fetchEntries();
      onEntryDeleted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la entrada",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Entradas del Día</CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {totalHours.toFixed(1)}h
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(selectedDate), "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando entradas...</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay entradas para este día
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {entry.hours}h
                      </Badge>
                      {entry.tasks && (
                        <span className="text-sm font-medium">{entry.tasks.name}</span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground">{entry.notes}</p>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará esta entrada
                          de trabajo y se actualizará el progreso de la tarea.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(entry.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyEntriesList;