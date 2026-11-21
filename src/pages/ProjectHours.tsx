import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import HourEntryDialog from "@/components/hours/HourEntryDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { type HourEntry, useDeleteHourEntry, useHourEntries } from "@/hooks/useHourEntries";
import { formatDate, formatHours, formatWeekday, hoursErrorMessage, sumHours } from "@/lib/hours";

/** HOURS-001 — "Ver Horas": todas las entradas de horas del proyecto con su cantidad y el total. */
export default function ProjectHours() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authed, setAuthed] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; entry: HourEntry | null }>({ open: false, entry: null });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setAuthed(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const projectQuery = useQuery({
    queryKey: ["project-name", projectId],
    enabled: authed && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const entriesQuery = useHourEntries(projectId, authed);
  const remove = useDeleteHourEntry(projectId ?? "");

  const entries = entriesQuery.data ?? [];
  const total = sumHours(entries.map((e) => e.hours));
  const projectName = projectQuery.data?.name ?? "";

  const handleDelete = async (entry: HourEntry) => {
    try {
      await remove.mutateAsync(entry.id);
      toast({ title: "Entrada borrada", description: `${formatHours(entry.hours)} h · ${formatDate(entry.work_date)}` });
    } catch (err) {
      if (import.meta.env.DEV) console.error("Hour entry delete error:", err);
      toast({ title: "Error", description: hoursErrorMessage(err as { code?: string; message?: string }), variant: "destructive" });
    }
  };

  const loading = !authed || projectQuery.isPending || entriesQuery.isPending;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)} aria-label="Volver al proyecto">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandLogo className="h-8 w-auto" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Horas</h1>
            <p className="text-sm text-muted-foreground truncate">{projectName || " "}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Cargando...</p>
        ) : projectQuery.isError || entriesQuery.isError ? (
          <p className="text-center text-destructive py-12">No se pudieron cargar las horas. Verifica tu conexión.</p>
        ) : !projectQuery.data ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">Proyecto no encontrado o eliminado.</p>
            <Button onClick={() => navigate("/")}>Volver al inicio</Button>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <Card className="border-0 shadow-md">
              <CardContent className="py-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{formatHours(total)} h</p>
                    <p className="text-sm text-muted-foreground">
                      Total · {entries.length} {entries.length === 1 ? "entrada" : "entradas"}
                    </p>
                  </div>
                </div>
                <Button onClick={() => setDialog({ open: true, entry: null })}>
                  <Plus className="h-4 w-4 mr-2" />
                  Entrar Horas
                </Button>
              </CardContent>
            </Card>

            {/* Listado */}
            {entries.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Aún no hay horas registradas en este proyecto.</p>
            ) : (
              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Día</TableHead>
                        <TableHead className="text-right">Horas</TableHead>
                        <TableHead className="hidden md:table-cell">Changelog(s)</TableHead>
                        <TableHead className="hidden sm:table-cell">Nota</TableHead>
                        <TableHead className="w-[96px]"><span className="sr-only">Acciones</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap text-sm align-top">
                            {formatDate(e.work_date)}
                            {e.notes && (
                              <span className="block sm:hidden mt-1 text-xs text-muted-foreground whitespace-normal">
                                {e.notes}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm capitalize align-top">{formatWeekday(e.work_date)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums align-top">{formatHours(e.hours)}</TableCell>
                          <TableCell className="hidden md:table-cell align-top">
                            {e.changelog_refs.length ? (
                              <ul className="text-sm font-mono space-y-0.5">
                                {e.changelog_refs.map((r) => <li key={r} className="break-all">{r}</li>)}
                              </ul>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell max-w-md align-top">
                            <span className="text-sm text-muted-foreground whitespace-pre-wrap">{e.notes || "—"}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDialog({ open: true, entry: e })}
                                aria-label="Editar entrada"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Borrar entrada" title="Borrar">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Borrar esta entrada?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se borrarán {formatHours(e.hours)} h del {formatWeekday(e.work_date)}{" "}
                                      {formatDate(e.work_date)}. Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDelete(e)}
                                    >
                                      Borrar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{formatHours(total)}</TableCell>
                        <TableCell className="hidden md:table-cell" />
                        <TableCell className="hidden sm:table-cell" />
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {projectId && (
        <HourEntryDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          projectId={projectId}
          projectName={projectName}
          entry={dialog.entry}
        />
      )}
    </div>
  );
}
