/**
 * HOURS-001 — Datos de hour_entries con TanStack Query.
 * Solo lee y escribe la tabla nueva hour_entries (RLS por auth.uid()).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HourEntryValues } from "@/lib/hours";

export interface HourEntry {
  id: string;
  project_id: string;
  work_date: string;
  hours: number;
  notes: string | null;
  changelog_refs: string[];
  created_at: string;
}

export const hourEntriesKey = (projectId: string) => ["hour_entries", projectId] as const;

/** Todas las entradas del proyecto, de la más reciente a la más antigua. */
export function useHourEntries(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: hourEntriesKey(projectId ?? ""),
    enabled: enabled && !!projectId,
    queryFn: async (): Promise<HourEntry[]> => {
      const { data, error } = await supabase
        .from("hour_entries")
        .select("id, project_id, work_date, hours, notes, changelog_refs, created_at")
        .eq("project_id", projectId)
        .order("work_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, hours: Number(r.hours), changelog_refs: r.changelog_refs ?? [] }));
    },
  });
}

/** Crea (sin id) o edita (con id) una entrada del proyecto. */
export function useSaveHourEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: HourEntryValues }) => {
      if (id) {
        const { data, error } = await supabase.from("hour_entries").update(values).eq("id", id).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("NOT_FOUND");
      } else {
        const { error } = await supabase.from("hour_entries").insert({ ...values, project_id: projectId });
        if (error) throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: hourEntriesKey(projectId) }),
  });
}

/** Borra una entrada (definitivo; la confirmación la pide la interfaz). */
export function useDeleteHourEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("hour_entries").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("NOT_FOUND");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: hourEntriesKey(projectId) }),
  });
}
