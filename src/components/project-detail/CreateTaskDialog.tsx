import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onTaskCreated: () => void;
}

const CreateTaskDialog = ({ open, onOpenChange, projectId, onTaskCreated }: CreateTaskDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    estimatedMin: "",
    estimatedMax: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        name: formData.name,
        description: formData.description || null,
        estimated_hours_min: formData.estimatedMin ? parseFloat(formData.estimatedMin) : null,
        estimated_hours_max: parseFloat(formData.estimatedMax),
      });

      if (error) throw error;

      toast({
        title: "¡Tarea creada!",
        description: "La tarea se ha creado correctamente",
      });

      setFormData({ name: "", description: "", estimatedMin: "", estimatedMax: "" });
      onOpenChange(false);
      onTaskCreated();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nueva Tarea</DialogTitle>
          <DialogDescription>
            Define una nueva tarea para este proyecto
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Nombre de la Tarea *</Label>
            <Input
              id="task-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Ej: Diseño de interfaz"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="task-description">Descripción</Label>
            <Textarea
              id="task-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalles de la tarea..."
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated-min">Horas Mínimas</Label>
              <Input
                id="estimated-min"
                type="number"
                min="0"
                step="0.5"
                value={formData.estimatedMin}
                onChange={(e) => setFormData({ ...formData, estimatedMin: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="estimated-max">Horas Máximas *</Label>
              <Input
                id="estimated-max"
                type="number"
                min="0"
                step="0.5"
                value={formData.estimatedMax}
                onChange={(e) => setFormData({ ...formData, estimatedMax: e.target.value })}
                required
                placeholder="20"
              />
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creando..." : "Crear Tarea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;