
## Cambios solicitados

### 1. Eliminar columna "% completado" en panel de Fases
En `src/components/project-detail/TaskTable.tsx`, eliminar la columna que muestra el porcentaje (ej. "100%") y su barra de progreso azul/celeste a la derecha de las horas. Se conservan: handle de arrastre, expand, nombre, horas, editar, eliminar.

### 2. Eliminar card "Progreso General" del dashboard
En `src/components/project-detail/ProjectSummary.tsx`, quitar el card de Progreso General. El grid pasa de 4 a 3 columnas en su lugar, pero como queremos mantener 4 slots (ver punto 3), simplemente reemplazamos ese card por uno nuevo.

### 3. Nuevo card "Fases del Proyecto" en la misma posición
Reemplazar el card de Progreso General por un card clickeable titulado "Fases del Proyecto" (con ícono `ListChecks` o similar) que navegue a una nueva página dedicada.

### 4. Nueva página `/project/:projectId/phases`
- Crear `src/pages/ProjectPhases.tsx` con header idéntico al de `ProjectDetail` (botón volver, logo, nombre del proyecto), y renderizar únicamente `<TaskSection />` (que internamente usa `TaskTable` ya sin la columna de %).
- Registrar la ruta en `src/App.tsx`.

### 5. Quitar `TaskSection` de `ProjectDetail`
Como ahora vive en su propia página, removerlo de `src/pages/ProjectDetail.tsx`. El dashboard queda: Summary (con nuevo card) → DailyWorkLog → ExcessHoursSection → ReportsSection → Facturación. Esto coincide con la segunda captura ("Solamente quedarían estas secciones en esta página").

## Archivos a modificar
- `src/components/project-detail/TaskTable.tsx` — eliminar columna de progreso
- `src/components/project-detail/ProjectSummary.tsx` — reemplazar card Progreso General por card-link a Fases
- `src/pages/ProjectDetail.tsx` — quitar `<TaskSection />`
- `src/pages/ProjectPhases.tsx` — nueva página
- `src/App.tsx` — nueva ruta

## Notas
- El cálculo de progreso del proyecto deja de mostrarse, pero la lógica en `ProjectSummary` que lo calcula se elimina junto con el card (no se usa en otro lado).
- El campo `progress` de cada tarea sigue existiendo en BD; solo se oculta visualmente en la tabla.
