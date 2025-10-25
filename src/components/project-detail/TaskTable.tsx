import { Fragment, useState } from "react";
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
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <TableHead className="text-right">Estimado</TableHead>
            <TableHead className="text-right">Horas Reales</TableHead>
            <TableHead className="text-right">Progreso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isOpen = expandedId === task.id;
            return (
              <Fragment key={task.id}>
                {/* Fila principal (compacta) */}
                <TableRow
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => setExpandedId(isOpen ? null : task.id)}
                  title={isOpen ? "Colapsar" : "Expandir"}
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4 transition-transform rotate-180" /> : <ChevronDown className="h-4 w-4 transition-transform" />}
                      <span className="font-medium">{task.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    {task.estimated_hours_min
                      ? `${task.estimated_hours_min}–${task.estimated_hours_max}h`
                      : `${task.estimated_hours_max}h`}
                  </TableCell>
                  <TableCell className="py-3 text-right">{task.actual_hours.toFixed(1)}h</TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span>{task.progress ?? 0}%</span>
                      <Progress value={task.progress ?? 0} className="w-24 h-2" />
                    </div>
                  </TableCell>
                </TableRow>

                {/* Fila de detalles */}
                {isOpen && (
                  <TableRow>
                    <TableCell colSpan={4} className="pb-4 pt-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          {task.description ? (
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-lg p-3">
                              {task.description}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground italic">Sin descripción</div>
                          )}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0">
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
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default TaskTable;