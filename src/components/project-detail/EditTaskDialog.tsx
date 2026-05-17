import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    name: string;
    description: string | null;
    estimated_hours_min: number | null;
    estimated_hours_max: number | null;
  };
  onSaved: () => void;
}

export default function EditTaskDialog({ open, onOpenChange, task, onSaved }: EditTaskDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: task.name,
    description: task.description ?? "",
    estimatedMin: task.estimated_hours_min?.toString() ?? "",
    estimatedMax: task.estimated_hours_max?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        estimated_hours_min: form.estimatedMin ? parseFloat(form.estimatedMin) : null,
        estimated_hours_max: form.estimatedMax ? parseFloat(form.estimatedMax) : null,
      };
      const { error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", task.id);
      if (error) throw error;
      toast({ title: "Tarea actualizada" });
      onSaved();
    } catch (err) {
      toast({ title: "Error", description: "No se pudo actualizar la tarea", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horas mínimas</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.estimatedMin}
                onChange={(e) => setForm(s => ({ ...s, estimatedMin: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Horas máximas</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="Opcional"
                value={form.estimatedMax}
                onChange={(e) => setForm(s => ({ ...s, estimatedMax: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
