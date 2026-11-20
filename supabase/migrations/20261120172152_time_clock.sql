-- TIME-CLOCK-001 — Ponchar horas: sesiones de trabajo y pausas.
-- Spec: docs/specs/TIME-CLOCK-001_Ponchar.md (§4 y Anexo A, con los ajustes A-1 a A-4 de la §3.1).
--
-- Solo crea objetos nuevos: no modifica ninguna tabla, función ni política existente.
-- Idempotente: se puede ejecutar dos veces seguidas sin error.
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sesiones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A-4: como invoices
  owner_uid   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- A-1 / D-5: día local (Puerto Rico) de la entrada; lo calcula la base, no el cliente
  work_date   date GENERATED ALWAYS AS ((started_at AT TIME ZONE 'America/Puerto_Rico')::date) STORED,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,                       -- NULL = sesión abierta
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_sessions_end_after_start CHECK (ended_at IS NULL OR ended_at > started_at)
);

COMMENT ON TABLE public.time_sessions IS 'TIME-CLOCK-001: sesiones de trabajo ponchadas (entrada/salida).';

-- D-2: una sola sesión abierta por usuario
CREATE UNIQUE INDEX IF NOT EXISTS time_sessions_one_open_per_owner
  ON public.time_sessions (owner_uid) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS time_sessions_owner_date_idx ON public.time_sessions (owner_uid, work_date);
CREATE INDEX IF NOT EXISTS time_sessions_project_idx    ON public.time_sessions (project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pausas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_session_breaks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.time_sessions(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,                       -- NULL = pausa abierta
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_session_breaks_end_after_start CHECK (ended_at IS NULL OR ended_at > started_at)
);

COMMENT ON TABLE public.time_session_breaks IS 'TIME-CLOCK-001: pausas dentro de una sesión ponchada.';

-- Una sola pausa abierta por sesión
CREATE UNIQUE INDEX IF NOT EXISTS time_session_breaks_one_open_per_session
  ON public.time_session_breaks (session_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS time_session_breaks_session_idx ON public.time_session_breaks (session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS (patrón de invoices; las pausas heredan por su sesión)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.time_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_session_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Time sessions: owner select" ON public.time_sessions;
CREATE POLICY "Time sessions: owner select" ON public.time_sessions
  FOR SELECT USING (auth.uid() = owner_uid);

DROP POLICY IF EXISTS "Time sessions: owner insert" ON public.time_sessions;
CREATE POLICY "Time sessions: owner insert" ON public.time_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = owner_uid
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_uid = auth.uid())
  );

DROP POLICY IF EXISTS "Time sessions: owner update" ON public.time_sessions;
CREATE POLICY "Time sessions: owner update" ON public.time_sessions
  FOR UPDATE USING (auth.uid() = owner_uid)
  WITH CHECK (
    auth.uid() = owner_uid
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_uid = auth.uid())
  );

DROP POLICY IF EXISTS "Time sessions: owner delete" ON public.time_sessions;
CREATE POLICY "Time sessions: owner delete" ON public.time_sessions
  FOR DELETE USING (auth.uid() = owner_uid);

DROP POLICY IF EXISTS "Time breaks: owner select" ON public.time_session_breaks;
CREATE POLICY "Time breaks: owner select" ON public.time_session_breaks
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.time_sessions s
                            WHERE s.id = time_session_breaks.session_id AND s.owner_uid = auth.uid()));

DROP POLICY IF EXISTS "Time breaks: owner insert" ON public.time_session_breaks;
CREATE POLICY "Time breaks: owner insert" ON public.time_session_breaks
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.time_sessions s
                                 WHERE s.id = session_id AND s.owner_uid = auth.uid()));

DROP POLICY IF EXISTS "Time breaks: owner update" ON public.time_session_breaks;
CREATE POLICY "Time breaks: owner update" ON public.time_session_breaks
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.time_sessions s
                            WHERE s.id = time_session_breaks.session_id AND s.owner_uid = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.time_sessions s
                      WHERE s.id = session_id AND s.owner_uid = auth.uid()));

DROP POLICY IF EXISTS "Time breaks: owner delete" ON public.time_session_breaks;
CREATE POLICY "Time breaks: owner delete" ON public.time_session_breaks
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.time_sessions s
                            WHERE s.id = time_session_breaks.session_id AND s.owner_uid = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. updated_at (función ya existente en el proyecto)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_time_sessions_updated_at ON public.time_sessions;
CREATE TRIGGER update_time_sessions_updated_at
  BEFORE UPDATE ON public.time_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Integridad de pausas: dentro de la sesión y sin solaparse entre sí
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_time_break()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  s_start timestamptz;
  s_end   timestamptz;
BEGIN
  -- Antes que el CHECK: así el mensaje es claro y tstzrange no falla con límites invertidos
  IF NEW.ended_at IS NOT NULL AND NEW.ended_at <= NEW.started_at THEN
    RAISE EXCEPTION 'El fin de la pausa debe ser posterior a su inicio';
  END IF;

  SELECT started_at, ended_at INTO s_start, s_end
    FROM public.time_sessions WHERE id = NEW.session_id;

  IF s_start IS NULL THEN
    RAISE EXCEPTION 'La sesión de la pausa no existe';
  END IF;
  IF NEW.started_at < s_start THEN
    RAISE EXCEPTION 'La pausa no puede empezar antes de la entrada';
  END IF;
  IF s_end IS NOT NULL AND (NEW.ended_at IS NULL OR NEW.ended_at > s_end) THEN
    RAISE EXCEPTION 'La pausa debe terminar antes de la salida';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.time_session_breaks b
     WHERE b.session_id = NEW.session_id
       AND b.id <> NEW.id
       AND tstzrange(b.started_at, COALESCE(b.ended_at, 'infinity'))
        && tstzrange(NEW.started_at, COALESCE(NEW.ended_at, 'infinity'))
  ) THEN
    RAISE EXCEPTION 'La pausa se solapa con otra pausa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_time_break_trg ON public.time_session_breaks;
CREATE TRIGGER validate_time_break_trg
  BEFORE INSERT OR UPDATE ON public.time_session_breaks
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_break();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Integridad de sesiones: una abierta (D-2), sin solapes (A-2), pausas dentro al editar
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_time_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.ended_at <= NEW.started_at THEN
    RAISE EXCEPTION 'La salida debe ser posterior a la entrada';
  END IF;

  -- D-2: el índice único lo garantiza; esto solo da un mensaje claro
  IF NEW.ended_at IS NULL AND EXISTS (
    SELECT 1 FROM public.time_sessions s
     WHERE s.owner_uid = NEW.owner_uid
       AND s.id <> NEW.id
       AND s.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya hay una sesión abierta: poncha la salida antes de una nueva entrada';
  END IF;

  -- A-2: sin solape con otras sesiones del mismo usuario (la abierta cuenta hasta infinito)
  IF EXISTS (
    SELECT 1 FROM public.time_sessions s
     WHERE s.owner_uid = NEW.owner_uid
       AND s.id <> NEW.id
       AND tstzrange(s.started_at, COALESCE(s.ended_at, 'infinity'))
        && tstzrange(NEW.started_at, COALESCE(NEW.ended_at, 'infinity'))
  ) THEN
    RAISE EXCEPTION 'La sesión se solapa con otra sesión';
  END IF;

  -- Al editar: ninguna pausa queda fuera de la sesión, ni abierta si la sesión se cierra
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM public.time_session_breaks b
     WHERE b.session_id = NEW.id
       AND (b.started_at < NEW.started_at
            OR (NEW.ended_at IS NOT NULL AND (b.ended_at IS NULL OR b.ended_at > NEW.ended_at)))
  ) THEN
    RAISE EXCEPTION 'Hay pausas fuera de la sesión o abiertas: ciérralas o ajústalas antes';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_time_session_trg ON public.time_sessions;
CREATE TRIGGER validate_time_session_trg
  BEFORE INSERT OR UPDATE ON public.time_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_session();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC (A-3): operaciones de varios pasos en una sola transacción.
--    SECURITY INVOKER: corren como el usuario, así que RLS y los triggers aplican igual.
-- ─────────────────────────────────────────────────────────────────────────────

-- Salida: cierra la pausa abierta (si la hay) y la sesión a la misma hora.
CREATE OR REPLACE FUNCTION public.clock_out(p_session_id uuid, p_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.time_session_breaks
     SET ended_at = p_at
   WHERE session_id = p_session_id
     AND ended_at IS NULL;

  UPDATE public.time_sessions
     SET ended_at = p_at
   WHERE id = p_session_id
     AND ended_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay una sesión abierta con ese id';
  END IF;
END;
$$;

-- Crea (p_session_id NULL) o edita una sesión con su lista completa de pausas.
-- Al editar: borra las pausas, actualiza la sesión y vuelve a insertar las pausas, de modo que cualquier
-- corrección se acepta si el resultado final es válido, sin depender del orden. Si algo falla, no cambia nada.
-- p_breaks: [{"started_at": "2026-11-20T12:00:00-04:00", "ended_at": "2026-11-20T12:45:00-04:00"}, ...]
CREATE OR REPLACE FUNCTION public.save_time_session(
  p_session_id uuid,
  p_project_id uuid,
  p_started_at timestamptz,
  p_ended_at   timestamptz,
  p_notes      text,
  p_breaks     jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id    uuid := p_session_id;
  v_break jsonb;
BEGIN
  IF jsonb_typeof(COALESCE(p_breaks, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_breaks debe ser una lista';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.time_sessions (project_id, started_at, ended_at, notes)
    VALUES (p_project_id, p_started_at, p_ended_at, p_notes)
    RETURNING id INTO v_id;
  ELSE
    DELETE FROM public.time_session_breaks WHERE session_id = v_id;

    UPDATE public.time_sessions
       SET project_id = p_project_id,
           started_at = p_started_at,
           ended_at   = p_ended_at,
           notes      = p_notes
     WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La sesión no existe';
    END IF;
  END IF;

  FOR v_break IN SELECT value FROM jsonb_array_elements(COALESCE(p_breaks, '[]'::jsonb)) LOOP
    INSERT INTO public.time_session_breaks (session_id, started_at, ended_at)
    VALUES (v_id, (v_break->>'started_at')::timestamptz, (v_break->>'ended_at')::timestamptz);
  END LOOP;

  RETURN v_id;
END;
$$;

-- Que la API (PostgREST) vea ya las tablas y funciones nuevas
NOTIFY pgrst, 'reload schema';

COMMIT;
