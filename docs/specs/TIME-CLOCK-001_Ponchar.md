# TIME-CLOCK-001 — Página "Ponchar" (reloj de horas trabajadas)

> **⚠ REEMPLAZADA (2026-11-20) por [HOURS-001](HOURS-001_Horas.md).** Carlos aclaró que lo que necesita es más
> sencillo: entrar fecha + cantidad de horas por proyecto y ver el listado con el total, sin reloj ni pausas.
> No se implementó la interfaz de Ponchar. La migración `20261120172152_time_clock.sql` llegó a aplicarse en
> producción; la migración de HOURS-001 elimina esos objetos. Este documento se conserva solo como historial.

| Campo | Valor |
|---|---|
| App | VP Projects Tracker |
| Solicitado por | Carlos Acevedo, 2026-11-20 |
| Estado | **Reemplazada por HOURS-001.** (Antes: v0.2, decisiones de la §3 aprobadas por Carlos el 2026-11-20) |
| Ejecuta | Claude Code (rama `feat/time-clock`) |

## 1. Solicitud (textual)

> "Quisiera que le añadiéramos una página a VP Project Tracker en la que yo pueda ponchar las horas trabajadas,
> que me permita entrar la hora de comienzo y las pausas y al final el total en horas."

**Definición de hecho (2 líneas):** una página `/ponchar` donde marco entrada, pausas y salida por proyecto, y veo el
total neto en horas del día y de cualquier rango. Los datos viven en la base (sobreviven a cerrar el navegador o
cambiar de equipo) y no tocan las entradas diarias ni las facturas existentes.

## 2. Alcance

**Incluido (v1):**
- Marcar **Entrada** (elige proyecto) → **Iniciar pausa / Terminar pausa** (las veces que haga falta) → **Salida**.
- Cronómetro en vivo del tiempo neto trabajado y estado (Trabajando / En pausa).
- Total del día y lista de sesiones de hoy.
- Historial por rango de fechas (presets Hoy / Semana / Mes, como en `AllEntries.tsx`) con totales por día y por proyecto.
- Corregir una sesión después (hora de entrada/salida, proyecto, notas, pausas) y agregar una sesión manual
  para un ponche olvidado.
- Borrar una sesión con confirmación.

**Fuera de alcance (v1):**
- Crear entradas en "Registrar Trabajo Diario" a partir de lo ponchado (candidato a v1.1, ver §3 D-8).
- Reportes PDF de ponches, geolocalización, multiusuario.

## 3. Decisiones propuestas (⚠ confirmar antes de implementar)

| ID | Decisión propuesta | Alternativa |
|---|---|---|
| D-1 | Cada sesión pertenece a **un proyecto** (obligatorio). Se preselecciona el último usado. | Sesiones sin proyecto. |
| D-2 | **Una sola sesión abierta a la vez** (lo garantiza la base de datos). Para cambiar de proyecto: Salida y nueva Entrada. | Varias sesiones simultáneas. |
| D-3 | Se permiten **varias sesiones por día** (p. ej. mañana y noche). | — |
| D-4 | Se guardan **horas exactas** (marca de tiempo). El total se muestra en `h:mm` y en decimal con 2 decimales, más una línea "**para facturar**" redondeada al **0.5 h más cercano** (como tus entradas actuales). | Redondeo a 0.25 h, o sin redondeo. |
| D-5 | Zona horaria `America/Puerto_Rico`. El **día** de una sesión es la fecha local de su entrada (una sesión que cruza medianoche cuenta para el día en que empezó). | — |
| D-6 | Si una sesión lleva más de **12 h** abierta, aviso "¿Olvidaste ponchar la salida?" con acceso directo a corregir la hora. | Otro umbral. |
| D-7 | Borrado definitivo con confirmación (los ponches no son registros de facturación; las facturas siguen saliendo de `daily_entries`). | Borrado lógico (`deleted_at`). |
| D-8 | v1.1 (no ahora): botón "Registrar en Trabajo Diario" que abre el formulario existente con las horas redondeadas ya puestas. | Incluirlo en v1. |
| D-9 | **Confirmada por Carlos (2026-11-20):** la sesión manual acepta **cualquier fecha pasada, sin límite**. Sirve para cargar de una vez las horas del mes pasado a hoy y, después, para el día que se olvide ponchar. Sin restricción por rol: Carlos es el único usuario y administrador. | Limitar la entrada retroactiva. |

### 3.1 Aprobado (Carlos, 2026-11-20)

D-1 a D-8 aprobadas tal como están propuestas, con estas precisiones:

- **D-1:** "último usado" = proyecto de la sesión más reciente (se lee de la base). El selector usa el mismo filtro
  que Home (`archived = false`).
- **D-4:** el redondeo "para facturar" se aplica al **total por día y proyecto** (no por sesión), al **0.5 h más
  cercano** (8:14 → 8.0; 8:15 → 8.5).
- **D-6:** el mismo aviso aparece en el diálogo de sesión manual si la duración pasa de 12 h.

Ajustes al Anexo A (el SQL definitivo está en `supabase/migrations/*_time_clock.sql`; el Anexo A queda como borrador):

- **A-1:** `work_date` es columna generada por la base desde `started_at` en `America/Puerto_Rico` (§4.1 decía
  "la calcula el cliente").
- **A-2:** las sesiones de un mismo usuario no se solapan (la sesión abierta cuenta hasta infinito); lo valida
  `validate_time_session()`, que pasa a BEFORE INSERT OR UPDATE.
- **A-3:** dos funciones RPC (SECURITY INVOKER, respetan RLS) para las operaciones de varios pasos:
  `clock_out()` (cierra pausa abierta + sesión) y `save_time_session()` (crea o edita una sesión con su lista de pausas).
- **A-4:** `owner_uid` con `DEFAULT auth.uid()` y FK a `auth.users(id) ON DELETE CASCADE`, como `invoices`.

Proceso:

- **L-1:** los archivos nuevos o modificados por esta feature quedan sin errores de lint; la deuda de lint ya
  existente en `main` queda fuera de alcance.
- **T-1:** pruebas con **vitest** (devDependency, `npm test`).

## 4. Modelo de datos

Dos tablas nuevas. **Ninguna tabla existente cambia.**

### 4.1 `time_sessions`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_uid` | uuid NOT NULL | `= auth.uid()` (RLS) |
| `project_id` | uuid NOT NULL | FK `projects(id)` ON DELETE CASCADE (igual que `daily_entries`) |
| `work_date` | date NOT NULL | fecha local de `started_at` (D-5), la calcula el cliente |
| `started_at` | timestamptz NOT NULL | |
| `ended_at` | timestamptz NULL | NULL = sesión abierta; si no es NULL, `> started_at` |
| `notes` | text NULL | |
| `created_at`, `updated_at` | timestamptz | `updated_at` con el trigger existente `update_updated_at_column()` |

Índice único parcial: una sola sesión abierta por usuario (`WHERE ended_at IS NULL`).

### 4.2 `time_session_breaks`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid NOT NULL | FK `time_sessions(id)` ON DELETE CASCADE |
| `started_at` | timestamptz NOT NULL | ≥ `started_at` de la sesión |
| `ended_at` | timestamptz NULL | NULL = pausa abierta; ≤ `ended_at` de la sesión si está cerrada |
| `created_at` | timestamptz | |

Índice único parcial: una sola pausa abierta por sesión. Las pausas de una sesión no se solapan (trigger).

### 4.3 Integridad en la base (no solo en la pantalla)

- `validate_time_break()` (BEFORE INSERT/UPDATE en pausas): la pausa cae dentro de la sesión y no se solapa con otra.
- `validate_time_session()` (BEFORE UPDATE en sesiones): al mover la entrada o cerrar la sesión, ninguna pausa queda
  fuera de los límites ni abierta.
- RLS en ambas tablas, patrón de `invoices` (`auth.uid() = owner_uid`); las pausas heredan por su sesión, y el
  INSERT/UPDATE de sesión exige además que el proyecto sea del usuario.

## 5. Cálculo del total

En una función pura `src/lib/timeclock.ts` (sin React, sin Supabase), con pruebas:

```
bruto   = (ended_at ?? ahora) − started_at
pausas  = Σ (pausa.ended_at ?? ahora) − pausa.started_at
neto    = bruto − pausas
```

- Mostrar `neto` como `h:mm` y como decimal (2 decimales).
- "Para facturar" = `neto` redondeado al 0.5 h más cercano (D-4).
- Ejemplo de control: entrada 08:00, salida 17:30, pausas 12:00–12:45 y 15:00–15:10 →
  bruto 9:30, pausas 0:55, **neto 8:35 = 8.58 h**, para facturar **8.5 h**.
- El cronómetro en vivo solo recalcula en pantalla; **no escribe en la base**.

## 6. Interfaz

- Ruta `/ponchar`, página `src/pages/TimeClock.tsx`, patrón de `src/pages/AllEntries.tsx`.
- Botón **"Ponchar"** (icono `Clock` de lucide) en el header de `Home.tsx`, junto a "Entradas". Si hay una sesión
  abierta, el botón muestra un punto verde.
- **Tarjeta "Ahora":**
  - Sin sesión abierta: selector de proyecto (proyectos no archivados), nota opcional, botón grande **Entrada**.
  - Con sesión abierta: proyecto, hora de entrada, cronómetro neto, estado; botones **Iniciar pausa / Terminar pausa**
    y **Salida**. Salida pide confirmación con un resumen (entrada, salida, pausas, neto, para facturar).
  - Salida con una pausa abierta: la pausa se cierra a la misma hora de la salida.
- **Tarjeta "Hoy":** sesiones de hoy (proyecto, entrada, salida, pausas, neto) y total del día.
- **Historial:** filtros Desde / Hasta / Proyecto y presets; agrupado por día con total diario, total del rango y
  subtotales por proyecto.
- **Editar sesión** (diálogo): entrada, salida, proyecto, notas y la lista de pausas (agregar / editar / quitar).
  Las mismas validaciones que la base; si la base rechaza, se muestra su mensaje.
- **Sesión manual:** el mismo diálogo, creando una sesión ya cerrada.
- Al volver a la pestaña (`refetchOnWindowFocus`) se recarga el estado desde la base, para que dos dispositivos
  vean lo mismo.
- Mensajes con `useToast`, como el resto de la app. Textos en español.

## 7. Criterios de aceptación (plan de prueba)

1. Entrada crea exactamente una sesión abierta; una segunda Entrada desde otra pestaña se rechaza con un mensaje claro.
2. Iniciar pausa crea una pausa abierta; no se puede iniciar otra mientras esa siga abierta.
3. Terminar pausa la cierra; el cronómetro deja de contar ese tiempo.
4. Salida con pausa abierta cierra la pausa y la sesión a la misma hora.
5. El ejemplo de la §5 (08:00–17:30, pausas de 45 y 10 min) da 8:35 / 8.58 h / 8.5 h para facturar.
6. Cerrar el navegador con una sesión abierta y volver: la sesión y el cronómetro siguen correctos.
7. Editar una pausa para que quede fuera de la sesión: la base la rechaza y el mensaje aparece en pantalla.
8. Agregar una sesión manual de ayer y otra de hace más de un mes: ambas se aceptan, aparecen en el historial de su
   día y suman al total (D-9).
9. Totales del historial correctos por día, por proyecto y del rango.
10. Las políticas RLS existen en las dos tablas (verificado con SELECT a `pg_policies`).
11. `daily_entries`, `invoices` e `invoice_items`: mismo conteo de filas y mismas sumas antes y después.
12. Home, Proyecto, Entradas y Facturación siguen funcionando igual.
13. `npm run build` y `npm run lint` sin errores; pruebas de `src/lib/timeclock.ts` en verde.

## 8. Orden de trabajo sugerido

1. Plan y confirmación de las decisiones D-1 a D-8 de la §3 (D-9 ya está confirmada).
2. Migración SQL (Anexo A) → Carlos aprueba → se aplica → verificación con SELECT.
3. `types.ts` + `src/lib/timeclock.ts` con sus pruebas.
4. Página, ruta y botón en Home.
5. Diálogos de editar y de sesión manual.
6. Plan de prueba de la §7, limpieza de datos de prueba, PR a `main`.

---

## Anexo A — SQL propuesto (idempotente)

> Borrador para revisión. Claude Code lo copia a `supabase/migrations/<timestamp>_time_clock.sql`, lo ajusta si el
> esquema vivo lo exige, y **no lo aplica sin aprobación**.

```sql
-- TIME-CLOCK-001 — Ponchar horas. Idempotente: se puede ejecutar dos veces sin error.
BEGIN;

-- 1. Sesiones
CREATE TABLE IF NOT EXISTS public.time_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid   uuid NOT NULL,
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_date   date NOT NULL,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_sessions_end_after_start CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS time_sessions_one_open_per_owner
  ON public.time_sessions (owner_uid) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS time_sessions_owner_date_idx ON public.time_sessions (owner_uid, work_date);
CREATE INDEX IF NOT EXISTS time_sessions_project_idx    ON public.time_sessions (project_id);

-- 2. Pausas
CREATE TABLE IF NOT EXISTS public.time_session_breaks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.time_sessions(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_session_breaks_end_after_start CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS time_session_breaks_one_open_per_session
  ON public.time_session_breaks (session_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS time_session_breaks_session_idx ON public.time_session_breaks (session_id);

-- 3. RLS
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

-- 4. updated_at (función ya existente en el proyecto)
DROP TRIGGER IF EXISTS update_time_sessions_updated_at ON public.time_sessions;
CREATE TRIGGER update_time_sessions_updated_at
  BEFORE UPDATE ON public.time_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Integridad de pausas
CREATE OR REPLACE FUNCTION public.validate_time_break()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s_start timestamptz;
  s_end   timestamptz;
BEGIN
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

-- 6. Integridad de sesiones (al mover la entrada o cerrar)
CREATE OR REPLACE FUNCTION public.validate_time_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
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
  BEFORE UPDATE ON public.time_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_session();

COMMIT;
```

**Verificado (2026-11-20)** en un PostgreSQL 16 desechable con `auth.uid()` y `projects` simulados al estilo Supabase:
el script corre dos veces seguidas sin error (idempotente) y pasa 20/20 pruebas — una sola sesión y una sola pausa
abiertas, pausas solapadas o fuera de la sesión rechazadas, cerrar con pausa abierta rechazado, proyecto ajeno
rechazado por RLS, otro usuario no ve ni borra nada, borrado en cascada de pausas, y el ejemplo de la §5 da
`08:35:00` / `8.58`. Antes de aplicarlo en Lovable Cloud hay que repetir la verificación contra el esquema vivo.

**Notas para la revisión:**
- Las funciones de validación corren como el usuario (SECURITY INVOKER), así que respetan RLS.
- En la Salida con pausa abierta, el cliente **primero** cierra la pausa y **después** la sesión
  (el trigger de sesión rechaza cerrar con una pausa abierta).
- `update_updated_at_column()` ya existe en la base (migración inicial). Todo va entre `BEGIN` y `COMMIT`:
  si un paso falla, no queda nada a medias.
