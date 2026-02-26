import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ymdToLocalDate } from "@/lib/date";
import { sanitizeText, validateNumber } from "@/lib/validation";
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

interface ExcessHoursSectionProps {
  projectId: string;
  onEntryChanged: () => void;
}

interface ExcessEntry {
  id: string;
  date_iso: string;
  hours: number;
  notes: string | null;
  invoice_id: string | null;
}

const ExcessHoursSection = ({ projectId, onEntryChanged }: ExcessHoursSectionProps) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ExcessEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    hours: "",
    notes: "",
  });

  useEffect(() => {
    fetchEntries();
  }, [projectId]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("daily_entries")
        .select("id, date_iso, hours, notes, invoice_id")
        .eq("project_id", projectId)
        .eq("entry_type", "excess")
        .order("date_iso", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las horas en exceso", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { error } = await supabase.from("daily_entries").insert({
        project_id: projectId,
        task_id: null,
        author_uid: user.id,
        date_iso: formData.date,
        hours: validateNumber(formData.hours, 0.1, 24),
        notes: sanitizeText(formData.notes, 10000),
        entry_type: "excess",
      });

      if (error) throw error;

      toast({ title: "¡Registrado!", description: "Horas en exceso registradas correctamente" });
      setFormData({ date: format(new Date(), "yyyy-MM-dd"), hours: "", notes: "" });
      fetchEntries();
      onEntryChanged();
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("Excess hours error:", error);
      toast({ title: "Error", description: "No se pudo registrar. Intenta nuevamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      const { error } = await supabase.from("daily_entries").delete().eq("id", entryId);
      if (error) throw error;
      toast({ title: "Eliminada", description: "Entrada eliminada correctamente" });
      fetchEntries();
      onEntryChanged();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const totalPending = entries.filter(e => !e.invoice_id).reduce((s, e) => s + e.hours, 0);
  const totalInvoiced = entries.filter(e => e.invoice_id).reduce((s, e) => s + e.hours, 0);

  return (
    <Card className="border-0 shadow-md border-l-4 border-l-orange-400">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <CardTitle>Horas Trabajadas en Exceso No Facturadas</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Registra horas que excedieron el estimado original y no fueron cobradas.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="excess-date">Fecha</Label>
            <Input
              id="excess-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              max={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="excess-hours">Horas *</Label>
            <Input
              id="excess-hours"
              type="number"
              min="0.1"
              step="0.1"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              required
              placeholder="2.5"
            />
          </div>
          <div className="space-y-1 md:col-span-1">
            <Label htmlFor="excess-notes">Descripción</Label>
            <Input
              id="excess-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ej: Revisiones adicionales..."
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Guardando..." : "Agregar"}
          </Button>
        </form>

        {/* Summary */}
        {entries.length > 0 && (
          <div className="flex gap-4 text-sm">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Pendientes: {totalPending.toFixed(1)}h
            </Badge>
            {totalInvoiced > 0 && (
              <Badge variant="secondary" className="gap-1">
                Facturadas: {totalInvoiced.toFixed(1)}h
              </Badge>
            )}
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="text-center text-muted-foreground py-4">Cargando...</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No hay horas en exceso registradas</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium">
                    {format(ymdToLocalDate(entry.date_iso), "dd/MM/yyyy")}
                  </span>
                  <Badge variant="outline">{entry.hours}h</Badge>
                  {entry.invoice_id ? (
                    <Badge variant="secondary" className="text-xs">Facturada</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Pendiente</Badge>
                  )}
                  {entry.notes && (
                    <span className="text-muted-foreground truncate max-w-[200px]">{entry.notes}</span>
                  )}
                </div>
                {!entry.invoice_id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExcessHoursSection;
