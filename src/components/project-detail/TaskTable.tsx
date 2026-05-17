import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronDown, Pencil, GripVertical } from "lucide-react";
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
import {
  DndContext,
  closestCenter,
  DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import EditTaskDialog from "./EditTaskDialog";

interface Task {
  id: string;
  name: string;
  description: string | null;
  estimated_hours_min: number | null;
  estimated_hours_max: number | null;
  actual_hours: number;
  progress: number;
  display_order: number | null;
}

interface TaskTableProps {
  tasks: Task[];
  onTaskDeleted: () => void;
}

interface SortableRowProps {
  task: Task;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string, taskName: string) => void;
}

const SortableRow = ({ task, isExpanded, onToggle, onEdit, onDelete }: SortableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-card">
      {/* Fila principal compacta */}
      <div className="grid grid-cols-[24px,1fr,150px,140px,140px,80px] items-center gap-3 p-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 cursor-pointer" onClick={onToggle}>
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          <span className="font-medium truncate">{task.name}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {task.estimated_hours_min && task.estimated_hours_max
            ? `${task.estimated_hours_min}–${task.estimated_hours_max}h`
            : task.estimated_hours_max
              ? `${task.estimated_hours_max}h`
              : "—"}
        </div>
        <div className="text-sm">{task.actual_hours.toFixed(1)}h</div>
        <div className="flex items-center gap-2">
          <span className="text-sm">{task.progress ?? 0}%</span>
          <Progress value={task.progress ?? 0} className="w-16 h-2" />
        </div>
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon" onClick={() => onEdit(task)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Eliminar">
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
                  onClick={() => onDelete(task.id, task.name)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      {/* Fila expandible con descripción */}
      {isExpanded && task.description && (
        <div className="px-3 pb-3 pt-0">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-lg p-3 bg-muted/20">
            {task.description}
          </div>
        </div>
      )}
    </div>
  );
}

const TaskTable = ({ tasks, onTaskDeleted }: TaskTableProps) => {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Sincronizar tasks prop con estado local
  useState(() => {
    setLocalTasks(tasks);
  });

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localTasks.findIndex(t => t.id === active.id);
    const newIndex = localTasks.findIndex(t => t.id === over.id);
    const reOrdered = arrayMove(localTasks, oldIndex, newIndex);

    // Actualizar UI optimistamente
    setLocalTasks(reOrdered);

    // Persistir orden en DB
    try {
      await Promise.all(
        reOrdered.map((t, idx) =>
          supabase.from("tasks").update({ display_order: idx }).eq("id", t.id)
        )
      );
      onTaskDeleted(); // Refrescar datos
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el orden",
        variant: "destructive",
      });
      // Revertir en caso de error
      setLocalTasks(tasks);
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
    <>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localTasks.map((task) => (
              <SortableRow
                key={task.id}
                task={task}
                isExpanded={expandedId === task.id}
                onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
                onEdit={setEditingTask}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
          onSaved={() => {
            setEditingTask(null);
            onTaskDeleted();
          }}
        />
      )}
    </>
  );
};

export default TaskTable;