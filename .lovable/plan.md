

# Plan: Excluir horas en exceso del resumen del proyecto

## Problema
La query en `ProjectSummary.tsx` (línea 40-43) trae todas las `daily_entries` sin filtrar por `entry_type`, por lo que las horas de tipo `excess` se suman a "Horas Trabajadas" y "Presupuesto Usado".

## Cambio

### `src/components/project-detail/ProjectSummary.tsx` (línea 40-43)
Agregar filtro para excluir entradas de tipo `excess`:

```typescript
supabase
  .from("daily_entries")
  .select("hours")
  .eq("project_id", project.id)
  .or("entry_type.eq.regular,entry_type.is.null"),
```

Esto es un cambio de 1 línea. Los totales se calcularán solo con entradas regulares.

