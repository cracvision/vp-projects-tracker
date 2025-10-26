import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import TaskTable from "./TaskTable";
import CreateTaskDialog from "./CreateTaskDialog";

interface TaskSectionProps {
  projectId: string;
  onTaskUpdate: () => void;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  estimated_hours_min: number | null;
  estimated_hours_max: number;
  actual_hours: number;
  progress: number;
  display_order: number;
}

const TaskSection = ({ projectId, onTaskUpdate }: TaskSectionProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las tareas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = () => {
    fetchTasks();
    onTaskUpdate();
  };

  const handleTaskDeleted = () => {
    fetchTasks();
    onTaskUpdate();
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tareas del Proyecto</CardTitle>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando tareas...</p>
        ) : (
          <TaskTable tasks={tasks} onTaskDeleted={handleTaskDeleted} />
        )}
      </CardContent>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={projectId}
        onTaskCreated={handleTaskCreated}
      />
    </Card>
  );
};

export default TaskSection;