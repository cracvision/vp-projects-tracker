import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import DailyEntriesList from "./DailyEntriesList";
import { sanitizeText, validateNumber } from "@/lib/validation";

interface DailyWorkLogProps {
  projectId: string;
  onEntryAdded: () => void;
}

interface Task {
  id: string;
  name: string;
}

const DailyWorkLog = ({ projectId, onEntryAdded }: DailyWorkLogProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formData, setFormData] = useState({
    taskId: "none",
    hours: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name")
        .eq("project_id", projectId)
        .order("display_order");

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las tareas",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("daily_entries").insert({
        project_id: projectId,
        task_id: formData.taskId === "none" ? null : formData.taskId || null,
        author_uid: user.id,
        date_iso: selectedDate,
        hours: validateNumber(formData.hours, 0.1, 24),
        notes: sanitizeText(formData.notes, 10000),
      });

      if (error) throw error;

      toast({
        title: "¡Entrada agregada!",
        description: "La entrada se ha registrado correctamente",
      });

      setFormData({ taskId: "none", hours: "", notes: "" });
      setRefreshKey(prev => prev + 1);
      onEntryAdded();
    } catch (error: any) {
      console.error("Daily work log error:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar la entrada. Por favor, intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Registrar Trabajo Diario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task">Tarea</Label>
              <Select
                value={formData.taskId}
                onValueChange={(value) => setFormData({ ...formData, taskId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una tarea..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Horas Trabajadas *</Label>
              <Input
                id="hours"
                type="number"
                min="0.1"
                step="0.1"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                required
                placeholder="2.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas del Progreso</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Describe lo que hiciste hoy..."
                rows={4}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Guardando..." : "Agregar Entrada"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <DailyEntriesList
        projectId={projectId}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        refreshKey={refreshKey}
        onEntryDeleted={onEntryAdded}
      />
    </div>
  );
};

export default DailyWorkLog;