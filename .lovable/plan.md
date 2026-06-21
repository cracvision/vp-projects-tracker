## Cambios solicitados

Reemplazar "Fase(s)" por "Tarea(s)" en toda la UI y renombrar las tareas existentes en la base de datos.

### 1. Cambios de texto en la UI

- **`src/components/project-detail/TaskSection.tsx`**: "Fases del Proyecto" → "Tareas del Proyecto", botón "Nueva Fase" → "Nueva Tarea".
- **`src/components/project-detail/ProjectSummary.tsx`**: tarjeta "Fases del Proyecto" → "Tareas del Proyecto", valor "Ver fases" → "Ver tareas", variable interna `isPhasesCard` ajustada al nuevo título.
- **`src/pages/ProjectPhases.tsx`**: subtítulo del header "Fases del proyecto" → "Tareas del proyecto".
- **`src/components/project-detail/DailyWorkLog.tsx`**: Label "Fase" → "Tarea", placeholder "Selecciona una fase..." → "Selecciona una tarea...".
- **`src/pages/AllEntries.tsx`**: Label "Fase" → "Tarea", opción "Todas las fases" → "Todas las tareas", `TableHead` "Fase" → "Tarea", mensaje del diálogo de borrado "progreso de la fase asociada" → "progreso de la tarea asociada".

No se renombra el archivo `ProjectPhases.tsx` ni la ruta `/project/:id/phases` para evitar romper enlaces; sólo cambia el texto visible.

### 2. Verificación en Reportes y Facturas

Revisé `src/lib/` (reports.ts, invoicePdf.ts), `src/components/billing/` y `ReportsSection.tsx` — no contienen las palabras "Phase" ni "Fase". Los PDFs muestran el nombre real de la tarea desde la BD, por lo que al renombrar las tareas (paso 3) los reportes y facturas reflejarán "Tarea N" automáticamente.

### 3. Renombrar tareas existentes en la base de datos

Hay 23 tareas con nombre `Phase N — ...`. Se ejecutará un UPDATE que reemplaza el prefijo `Phase ` por `Tarea ` conservando el número y el resto del nombre:

```sql
UPDATE public.tasks
SET name = regexp_replace(name, '^Phase ', 'Tarea ')
WHERE name ~ '^Phase ';
```

Esto convertirá, por ejemplo, `Phase 1 — Assessment & Documentation` en `Tarea 1 — Assessment & Documentation`. Como `daily_entries` referencia a `tasks` por `task_id`, no hay datos adicionales que actualizar; los nombres aparecerán actualizados en toda la app, reportes y futuras facturas.

### Fuera de alcance

- No se modifica el nombre del archivo `ProjectPhases.tsx` ni la ruta `/phases`.
- No se modifica el esquema de la BD ni triggers.
