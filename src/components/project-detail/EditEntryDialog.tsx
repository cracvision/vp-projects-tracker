import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { validateNumber, sanitizeText } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";

type Task = { id: string; name: string };

interface EditEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  projectId: string;
  initial: { taskId: string | null; hours: number; notes: string | null; date_iso: string };
  onSaved: () => void;
}

export default function EditEntryDialog({
  open, onOpenChange, entryId, projectId, initial, onSaved,
}: EditEntryDialogProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({
    taskId: initial.taskId ?? "none",
    hours: String(initial.hours ?? ""),
    notes: initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("tasks").select("id,name").eq("project_id", projectId).order("display_order");
      setTasks(data || []);
    })();
  }, [open, projectId]);

  useEffect(() => {
    setForm({
      taskId: initial.taskId ?? "none",
      hours: String(initial.hours ?? ""),
      notes: initial.notes ?? "",
    });
  }, [initial]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        task_id: form.taskId === "none" ? null : form.taskId,
        hours: validateNumber(form.hours, 0.1, 24),
        notes: sanitizeText(form.notes, 2000),
      };
      const { error } = await supabase.from("daily_entries").update(payload).eq("id", entryId);
      if (error) throw error;
      
      toast({
        title: "Entrada actualizada",
        description: "Los cambios se han guardado correctamente",
      });
      
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la entrada",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar entrada</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tarea</Label>
            <Select value={form.taskId} onValueChange={(v) => setForm((s) => ({ ...s, taskId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona una tarea..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Horas *</Label>
            <Input type="number" min="0.1" step="0.1"
              value={form.hours}
              onChange={(e) => setForm((s) => ({ ...s, hours: e.target.value }))} required />
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea rows={5}
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
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
