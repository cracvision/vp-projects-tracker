import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

const CreateProjectDialog = ({ open, onOpenChange, onProjectCreated }: CreateProjectDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sow: "",
    dueDate: "",
    hourlyRate: "65",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("projects").insert({
        name: formData.name,
        sow: formData.sow || null,
        due_date: formData.dueDate || null,
        hourly_rate: parseFloat(formData.hourlyRate),
        owner_uid: user.id,
      });

      if (error) throw error;

      toast({
        title: "¡Proyecto creado!",
        description: "El proyecto se ha creado correctamente",
      });

      setFormData({ name: "", sow: "", dueDate: "", hourlyRate: "65" });
      onOpenChange(false);
      onProjectCreated();
    } catch (error: any) {
      console.error("Create project error:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el proyecto. Por favor, intenta nuevamente.",
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
          <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
          <DialogDescription>
            Ingresa los detalles del proyecto para comenzar
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Proyecto *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Ej: Desarrollo App Móvil"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sow">SOW (Statement of Work)</Label>
            <Textarea
              id="sow"
              value={formData.sow}
              onChange={(e) => setFormData({ ...formData, sow: e.target.value })}
              placeholder="Descripción del alcance del proyecto..."
              rows={4}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha de Entrega</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Tarifa/Hora ($)</Label>
              <Input
                id="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
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
              {loading ? "Creando..." : "Crear Proyecto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;