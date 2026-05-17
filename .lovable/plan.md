# Plan: Vista global de Entradas de Trabajo

Nueva página dedicada `/entries` para consultar todas las entradas diarias en un solo lugar, con filtros y dos modos de vista.

## 1. Ruta y navegación

- Nueva ruta `/entries` registrada en `src/App.tsx`.
- Link "Entradas" en el header (en `Home` y `ProjectDetail`) que apunte a `/entries`. Botón de regreso al home dentro de la página.

## 2. Página `src/pages/AllEntries.tsx`

Estructura:

```text
┌─────────────────────────────────────────────────┐
│ Header (logo, título, back)                     │
├─────────────────────────────────────────────────┤
│ Filtros (sticky card)                           │
│  • Proyecto (Select, default "Todos")           │
│  • Fase (Select, depende del proyecto)          │
│  • Tipo (Todos / Regular / Excess)              │
│  • Rango fechas (Desde / Hasta + presets:       │
│    Hoy, Semana, Mes, Año, Todo)                 │
│  • Búsqueda libre en notas                      │
│  • Botón "Limpiar filtros"                      │
├─────────────────────────────────────────────────┤
│ Resumen de totales                              │
│  Total horas | # entradas | desglose por        │
│  proyecto (chips con horas)                     │
├─────────────────────────────────────────────────┤
│ Toggle [Lista | Tabla]                          │
├─────────────────────────────────────────────────┤
│ Contenido según vista                           │
└─────────────────────────────────────────────────┘
```

### Vista Lista (`EntriesListView`)
Reutiliza el estilo de `DailyEntriesList`: agrupada por fecha (encabezado con día + total de horas del día), cada item expandible muestra notas con `ReactMarkdown`. Acciones: editar (abre `EditEntryDialog`) y eliminar (con `AlertDialog`).

### Vista Tabla (`EntriesTableView`)
Columnas ordenables: Fecha | Proyecto | Fase | Tipo | Horas | Notas (truncadas con tooltip/expand) | Acciones. Mismas acciones inline.

## 3. Data fetching

Un solo query a `daily_entries` con joins:

```ts
supabase
  .from("daily_entries")
  .select("*, projects!inner(id,name,owner_uid), tasks(id,name)")
  .eq("projects.owner_uid", user.id)
  .order("date_iso", { ascending: false })
  .order("created_at", { ascending: false });
```

RLS ya garantiza que solo el dueño ve sus entradas. Filtros aplicados en cliente (volumen esperado bajo). Si el dataset crece, se puede mover a server-side filtering después.

Lista de proyectos para el dropdown: `projects` del usuario (no archivados primero, archivados al final con etiqueta). Lista de fases: `tasks` del proyecto seleccionado, ordenadas por `display_order`.

## 4. Componentes nuevos

- `src/pages/AllEntries.tsx` — página principal
- `src/components/entries/EntriesFilters.tsx` — barra de filtros
- `src/components/entries/EntriesSummary.tsx` — totales y chips
- `src/components/entries/EntriesListView.tsx` — agrupada por fecha
- `src/components/entries/EntriesTableView.tsx` — tabla compacta
- `src/components/entries/EntryActions.tsx` — botones editar/eliminar reutilizables

`EditEntryDialog` actual ya recibe `projectId`, así que se pasa el del entry editado. Eliminación con la misma lógica de `DailyEntriesList`.

## 5. Detalles técnicos

- Persistir filtros en query string (`?project=&from=&to=&type=&q=&view=`) para que se puedan compartir y sobrevivan refresh.
- Usar `ymdToLocalDate` para parseo/formato de fechas (regla del proyecto).
- `console.error` envueltos en `import.meta.env.DEV`.
- Toggle Lista/Tabla guardado en `localStorage` (`entries:view`).
- Vista Tabla con `overflow-auto` en móvil; en `752px` el toggle por defecto será Lista.
- Estado vacío claro cuando no hay resultados con los filtros activos.

## 6. Sin cambios de backend

No requiere migraciones ni cambios de RLS — todo se resuelve con queries existentes.

## Fuera de alcance

- Exportar CSV (no lo pediste; lo podemos agregar luego si quieres).
- Crear entradas desde esta vista (se siguen creando desde el proyecto).
- Paginación server-side (se agrega si el volumen lo justifica).
