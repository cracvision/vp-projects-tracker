-- HOURS-001 — Registro de horas por proyecto ("Entrar Horas" / "Ver Horas").
-- Spec: docs/specs/HOURS-001_Horas.md (§4).
--
-- 1. Elimina los objetos de TIME-CLOCK-001 (Ponchar), reemplazada por HOURS-001 (decisión H-6).
--    Sin CASCADE: si algo inesperado dependiera de ellos, la migración falla y no borra nada.
-- 2. Crea public.hour_entries con RLS por auth.uid() (patrón de invoices).
--
-- No modifica ninguna tabla, función ni política existente fuera de las de Ponchar.
-- Idempotente: se puede ejecutar dos veces seguidas sin error.
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Quitar Ponchar (TIME-CLOCK-001). Al borrar las tablas se van sus índices,
--    políticas y triggers; las funciones de trigger se borran después.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.clock_out(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.save_time_session(uuid, uuid, timestamptz, timestamptz, text, jsonb);
DROP TABLE IF EXISTS public.time_session_breaks;
DROP TABLE IF EXISTS public.time_sessions;
DROP FUNCTION IF EXISTS public.validate_time_break();
DROP FUNCTION IF EXISTS public.validate_time_session();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Entradas de horas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hour_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_date   date NOT NULL,                     -- fecha de calendario del trabajo (H-3 se valida en el cliente)
  hours       numeric(4,2) NOT NULL,             -- H-1: hasta 2 decimales
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hour_entries_hours_range CHECK (hours > 0 AND hours <= 24),
  CONSTRAINT hour_entries_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

COMMENT ON TABLE public.hour_entries IS 'HOURS-001: horas registradas por proyecto y fecha. No alimenta facturas.';

-- Listado "Ver Horas" (por proyecto, más reciente primero) y borrado en cascada del proyecto
CREATE INDEX IF NOT EXISTS hour_entries_project_date_idx ON public.hour_entries (project_id, work_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS (patrón de invoices)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hour_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hour entries: owner select" ON public.hour_entries;
CREATE POLICY "Hour entries: owner select" ON public.hour_entries
  FOR SELECT USING (auth.uid() = owner_uid);

DROP POLICY IF EXISTS "Hour entries: owner insert" ON public.hour_entries;
CREATE POLICY "Hour entries: owner insert" ON public.hour_entries
  FOR INSERT WITH CHECK (
    auth.uid() = owner_uid
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_uid = auth.uid())
  );

DROP POLICY IF EXISTS "Hour entries: owner update" ON public.hour_entries;
CREATE POLICY "Hour entries: owner update" ON public.hour_entries
  FOR UPDATE USING (auth.uid() = owner_uid)
  WITH CHECK (
    auth.uid() = owner_uid
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_uid = auth.uid())
  );

DROP POLICY IF EXISTS "Hour entries: owner delete" ON public.hour_entries;
CREATE POLICY "Hour entries: owner delete" ON public.hour_entries
  FOR DELETE USING (auth.uid() = owner_uid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. updated_at (función ya existente en el proyecto)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_hour_entries_updated_at ON public.hour_entries;
CREATE TRIGGER update_hour_entries_updated_at
  BEFORE UPDATE ON public.hour_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Que la API (PostgREST) vea la tabla nueva y deje de ver las de Ponchar
NOTIFY pgrst, 'reload schema';

COMMIT;
