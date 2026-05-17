import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Clock, Search, ChevronDown, ChevronUp, Pencil, Trash2, X, List, Table as TableIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ymdToLocalDate } from "@/lib/date";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EditEntryDialog from "@/components/project-detail/EditEntryDialog";

interface ProjectLite { id: string; name: string; archived: boolean | null; }
interface TaskLite { id: string; name: string; project_id: string; display_order: number | null; }
interface Entry {
  id: string;
  project_id: string;
  task_id: string | null;
  hours: number;
  notes: string | null;
  date_iso: string;
  created_at: string;
  entry_type: string;
  projects: { id: string; name: string } | null;
  tasks: { id: string; name: string } | null;
}

type ViewMode = "list" | "table";

const VIEW_KEY = "entries:view";

const PRESETS = [
  { id: "all", label: "Todo" },
  { id: "today", label: "Hoy" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "year", label: "Año" },
] as const;

function applyPreset(id: string): { from: string; to: string } {
  const today = new Date();
  const ymd = (d: Date) => format(d, "yyyy-MM-dd");
  switch (id) {
    case "today": return { from: ymd(today), to: ymd(today) };
    case "week": return { from: ymd(startOfWeek(today, { weekStartsOn: 1 })), to: ymd(today) };
    case "month": return { from: ymd(startOfMonth(today)), to: ymd(today) };
    case "year": return { from: ymd(startOfYear(today)), to: ymd(today) };
    default: return { from: "", to: "" };
  }
}

export default function AllEntries() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const projectId = params.get("project") || "all";
  const taskId = params.get("task") || "all";
  const type = params.get("type") || "all";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const q = params.get("q") || "";
  const view = (params.get("view") as ViewMode) || (localStorage.getItem(VIEW_KEY) as ViewMode) || "list";

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ open: boolean; entry: Entry | null }>({ open: false, entry: null });
  const [refreshKey, setRefreshKey] = useState(0);

  function updateParam(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    });
    setParams(next, { replace: true });
  }

  function setView(v: ViewMode) {
    localStorage.setItem(VIEW_KEY, v);
    updateParam({ view: v });
  }

  // Auth + initial data
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const [p, t] = await Promise.all([
        supabase.from("projects").select("id,name,archived").order("archived").order("name"),
        supabase.from("tasks").select("id,name,project_id,display_order").order("display_order"),
      ]);
      setProjects((p.data as ProjectLite[]) || []);
      setTasks((t.data as TaskLite[]) || []);
    })();
  }, [navigate]);

  // Entries fetch
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("daily_entries")
          .select("id,project_id,task_id,hours,notes,date_iso,created_at,entry_type,projects(id,name),tasks(id,name)")
          .order("date_iso", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        setEntries((data as any) || []);
      } catch (e) {
        if (import.meta.env.DEV) console.error("Entries fetch error:", e);
        toast({ title: "Error", description: "No se pudieron cargar las entradas", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey, toast]);

  const tasksForProject = useMemo(
    () => projectId === "all" ? [] : tasks.filter(t => t.project_id === projectId),
    [tasks, projectId]
  );

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return entries.filter(e => {
      if (projectId !== "all" && e.project_id !== projectId) return false;
      if (taskId !== "all" && e.task_id !== taskId) return false;
      if (type !== "all") {
        const et = e.entry_type || "regular";
        if (type === "regular" && et !== "regular") return false;
        if (type === "excess" && et !== "excess") return false;
      }
      if (from && e.date_iso < from) return false;
      if (to && e.date_iso > to) return false;
      if (qLower && !(e.notes || "").toLowerCase().includes(qLower)) return false;
      return true;
    });
  }, [entries, projectId, taskId, type, from, to, q]);

  const totals = useMemo(() => {
    const totalHours = filtered.reduce((s, e) => s + Number(e.hours || 0), 0);
    const byProject = new Map<string, { name: string; hours: number }>();
    filtered.forEach(e => {
      const key = e.project_id;
      const name = e.projects?.name || "—";
      const cur = byProject.get(key) || { name, hours: 0 };
      cur.hours += Number(e.hours || 0);
      byProject.set(key, cur);
    });
    return { totalHours, count: filtered.length, byProject: Array.from(byProject.values()) };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    filtered.forEach(e => {
      const arr = map.get(e.date_iso) || [];
      arr.push(e);
      map.set(e.date_iso, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("daily_entries").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Entrada eliminada" });
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      if (import.meta.env.DEV) console.error("Delete entry error:", e);
      toast({ title: "Error", description: "No se pudo eliminar la entrada", variant: "destructive" });
    }
  }

  function clearFilters() {
    setParams(view !== "list" ? new URLSearchParams({ view }) : new URLSearchParams(), { replace: true });
  }

  const hasFilters = projectId !== "all" || taskId !== "all" || type !== "all" || !!from || !!to || !!q;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}> <ArrowLeft className="h-5 w-5" /> </Button>
          <BrandLogo className="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-bold">Entradas de Trabajo</h1>
            <p className="text-sm text-muted-foreground">Vista global filtrable</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filtros */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filtros</CardTitle>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Proyecto</Label>
                <Select value={projectId} onValueChange={(v) => updateParam({ project: v, task: "all" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proyectos</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.archived ? " (archivado)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Fase</Label>
                <Select value={taskId} onValueChange={(v) => updateParam({ task: v })} disabled={projectId === "all"}>
                  <SelectTrigger><SelectValue placeholder={projectId === "all" ? "Selecciona un proyecto" : "Todas"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fases</SelectItem>
                    {tasksForProject.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={(v) => updateParam({ type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="excess">Horas en exceso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={from} onChange={(e) => updateParam({ from: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={to} onChange={(e) => updateParam({ to: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Buscar en notas</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => updateParam({ q: e.target.value || null })} className="pl-8" placeholder="Texto..." />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <Button key={p.id} variant="outline" size="sm" onClick={() => {
                  const r = applyPreset(p.id);
                  updateParam({ from: r.from || null, to: r.to || null });
                }}>
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resumen */}
        <Card className="border-0 shadow-md">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="gap-1 text-sm py-1.5">
                <Clock className="h-3.5 w-3.5" /> {totals.totalHours.toFixed(1)}h totales
              </Badge>
              <Badge variant="outline" className="text-sm py-1.5">{totals.count} entradas</Badge>
              <div className="h-6 w-px bg-border mx-1" />
              {totals.byProject.length === 0 ? (
                <span className="text-sm text-muted-foreground">Sin datos</span>
              ) : totals.byProject.map((p, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {p.name}: {p.hours.toFixed(1)}h
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Toggle vista */}
        <div className="flex justify-end">
          <div className="inline-flex rounded-md border bg-card p-1">
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
              <List className="h-4 w-4 mr-1" /> Lista
            </Button>
            <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setView("table")}>
              <TableIcon className="h-4 w-4 mr-1" /> Tabla
            </Button>
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No hay entradas con los filtros aplicados</p>
        ) : view === "list" ? (
          <div className="space-y-6">
            {grouped.map(([date, items]) => {
              const dayHours = items.reduce((s, e) => s + Number(e.hours || 0), 0);
              return (
                <div key={date}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">
                      {format(ymdToLocalDate(date), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                    </h3>
                    <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{dayHours.toFixed(1)}h</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.map(e => {
                      const isOpen = expandedId === e.id;
                      return (
                        <div key={e.id} className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between gap-3">
                            <button className="flex-1 text-left" onClick={() => setExpandedId(isOpen ? null : e.id)}>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{Number(e.hours).toFixed(1)}h</Badge>
                                <span className="text-sm font-medium">{e.projects?.name || "—"}</span>
                                {e.tasks && <span className="text-xs text-muted-foreground">· {e.tasks.name}</span>}
                                {e.entry_type === "excess" && <Badge variant="secondary" className="text-xs">Excess</Badge>}
                                {isOpen ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                              </div>
                            </button>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEditing({ open: true, entry: e })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <DeleteButton onConfirm={() => handleDelete(e.id)} />
                            </div>
                          </div>
                          {isOpen && (
                            <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                              {e.notes
                                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.notes}</ReactMarkdown>
                                : <em>Sin notas</em>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="w-[110px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(ymdToLocalDate(e.date_iso), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm">{e.projects?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{e.tasks?.name || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {e.entry_type === "excess" ? <Badge variant="secondary">Excess</Badge> : <span className="text-muted-foreground">Regular</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">{Number(e.hours).toFixed(1)}</TableCell>
                      <TableCell className="max-w-md">
                        <span className="line-clamp-2 text-sm text-muted-foreground" title={e.notes || ""}>
                          {e.notes || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing({ open: true, entry: e })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton onConfirm={() => handleDelete(e.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      {editing.entry && (
        <EditEntryDialog
          open={editing.open}
          onOpenChange={(o) => setEditing(s => ({ ...s, open: o }))}
          entryId={editing.entry.id}
          projectId={editing.entry.project_id}
          initial={{
            taskId: editing.entry.task_id,
            hours: Number(editing.entry.hours),
            notes: editing.entry.notes,
            date_iso: editing.entry.date_iso,
          }}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer y actualizará el progreso de la fase asociada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}