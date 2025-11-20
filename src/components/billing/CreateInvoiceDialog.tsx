import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { ymdToLocalDate } from "@/lib/date";

interface DailyEntry {
  id: string;
  date_iso: string;
  hours: number;
  notes: string | null;
  tasks: { name: string } | null;
}

interface Project {
  id: string;
  name: string;
  hourly_rate: number;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onCreated: () => void;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: CreateInvoiceDialogProps) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, project.id, startDate, endDate]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("daily_entries")
        .select("id, date_iso, hours, notes, tasks(name)")
        .eq("project_id", project.id)
        .is("invoice_id", null)
        .order("date_iso", { ascending: true })
        .order("created_at", { ascending: true });

      if (startDate) {
        query = query.gte("date_iso", startDate);
      }
      if (endDate) {
        query = query.lte("date_iso", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
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

  const toggleEntry = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const selectedEntries = entries.filter((e) => selectedIds.has(e.id));
  const totalHours = selectedEntries.reduce((sum, e) => sum + Number(e.hours), 0);
  const rate = project.hourly_rate ?? 65;
  const totalAmount = totalHours * rate;

  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos una entrada",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // 1) Crear invoice (el trigger asignará invoice_number)
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert([
          {
            owner_uid: user.id,
            project_id: project.id,
            status: "Pendiente",
            date: invoiceDate,
            due_date: dueDate || null,
            total_amount: 0,
            notes: notes || null,
            invoice_number: 0, // El trigger lo reemplazará
          },
        ])
        .select("*")
        .single();

      if (invErr) throw invErr;

      // 2) Crear items y calcular total
      let total = 0;
      const itemsPayload = selectedEntries.map((e) => {
        const amount = Number(e.hours) * Number(rate);
        total += amount;
        const taskName = e.tasks?.name || "Trabajo";
        const desc = `[${e.date_iso}] ${taskName} — ${e.notes || ""}`;
        return {
          invoice_id: inv.id,
          daily_entry_id: e.id,
          description: desc,
          entry_date: e.date_iso,
          task_name: e.tasks?.name || null,
          hours: e.hours,
          rate,
          amount,
        };
      });

      const { error: itemsErr } = await supabase
        .from("invoice_items")
        .insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // 3) Marcar entradas como facturadas
      const { error: markErr } = await supabase
        .from("daily_entries")
        .update({ invoice_id: inv.id })
        .in("id", Array.from(selectedIds));
      if (markErr) throw markErr;

      // 4) Actualizar total
      await supabase
        .from("invoices")
        .update({ total_amount: total })
        .eq("id", inv.id);

      // Obtener el número asignado
      const { data: finalInvoice } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("id", inv.id)
        .single();

      toast({
        title: "Factura creada",
        description: `Factura #${finalInvoice?.invoice_number || inv.invoice_number} creada exitosamente`,
      });

      onCreated();
      onOpenChange(false);
      setSelectedIds(new Set());
      setDueDate("");
      setNotes("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Factura - {project.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha inicio (filtro)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Fecha fin (filtro)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Fecha y notas de la factura */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de la factura</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Fecha de vencimiento</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas / Condiciones</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condiciones de pago, observaciones..."
            />
          </div>

          {/* Lista de entradas */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="font-semibold">
                Entradas sin facturar ({entries.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAll}
                disabled={loading || entries.length === 0}
              >
                {selectedIds.size === entries.length
                  ? "Deseleccionar todo"
                  : "Seleccionar todo"}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No hay entradas pendientes de facturar
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => toggleEntry(entry.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => toggleEntry(entry.id)}
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">
                        {format(ymdToLocalDate(entry.date_iso), "dd/MM/yyyy")} -{" "}
                        {entry.tasks?.name || "Sin tarea"} ({entry.hours}h)
                      </div>
                      {entry.notes && (
                        <div className="text-muted-foreground line-clamp-1">
                          {entry.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totales */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Entradas seleccionadas:</span>
              <span className="font-medium">{selectedIds.size}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total horas:</span>
              <span className="font-medium">{totalHours.toFixed(2)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tarifa:</span>
              <span className="font-medium">
                ${rate.toFixed(2)}/h
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || selectedIds.size === 0}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Factura
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
