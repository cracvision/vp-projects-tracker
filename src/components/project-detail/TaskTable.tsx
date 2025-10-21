import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface Task {
  id: string;
  name: string;
  description: string | null;
  estimated_hours_min: number | null;
  estimated_hours_max: number;
  actual_hours: number;
  progress: number;
}

interface TaskTableProps {
  tasks: Task[];
  onTaskDeleted: () => void;
}

const TaskTable = ({ tasks, onTaskDeleted }: TaskTableProps) => {
  const { toast } = useToast();

  const handleDelete = async (taskId: string, taskName: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Tarea eliminada",
        description: `"${taskName}" ha sido eliminada`,
      });
      onTaskDeleted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la tarea",
        variant: "destructive",
      });
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay tareas aún. ¡Crea tu primera tarea!
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarea</TableHead>
            <TableHead>Estimado</TableHead>
            <TableHead>Horas Reales</TableHead>
            <TableHead>Progreso</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{task.name}</p>
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {task.estimated_hours_min
                  ? `${task.estimated_hours_min}-${task.estimated_hours_max}h`
                  : `${task.estimated_hours_max}h`}
              </TableCell>
              <TableCell>{task.actual_hours.toFixed(1)}h</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Progress value={task.progress} className="flex-1" />
                  <span className="text-sm font-medium">{task.progress}%</span>
                </div>
              </TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará la tarea "{task.name}"
                        y todas sus entradas diarias asociadas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(task.id, task.name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TaskTable;