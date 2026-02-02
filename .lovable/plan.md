
# Plan: Corregir el campo "Tarea" en el diálogo de edición de entradas

## Problema identificado
Cuando editas una entrada diaria existente que tiene una tarea asignada, el campo "Tarea" en el modal de edicion muestra "Sin asignar" en lugar de la tarea correcta. Esto te obliga a recordar y re-seleccionar la tarea manualmente cada vez que quieres editar cualquier otro campo (horas o notas).

## Causa raiz
La interfaz TypeScript `DailyEntry` en `DailyEntriesList.tsx` no incluye el campo `task_id` de forma explicita. Aunque el campo existe en la respuesta de la base de datos, el codigo lo accede mediante un cast `(entry as any).task_id` que puede fallar silenciosamente.

## Solucion

### Archivo a modificar
`src/components/project-detail/DailyEntriesList.tsx`

### Cambios especificos

1. **Actualizar la interfaz `DailyEntry`** (lineas 27-33) para incluir los campos faltantes:
   - Agregar `task_id: string | null`
   - Agregar `date_iso: string`

2. **Eliminar los casts `as any`** (lineas 169, 172) y usar los campos tipados correctamente:
   - Cambiar `(entry as any).task_id` a `entry.task_id`
   - Cambiar `(entry as any).date_iso` a `entry.date_iso`

---

## Seccion Tecnica

### Interfaz actual
```typescript
interface DailyEntry {
  id: string;
  hours: number;
  notes: string | null;
  created_at: string;
  tasks: { name: string } | null;
}
```

### Interfaz corregida
```typescript
interface DailyEntry {
  id: string;
  task_id: string | null;
  hours: number;
  notes: string | null;
  created_at: string;
  date_iso: string;
  tasks: { name: string } | null;
}
```

### Codigo corregido para pasar el initial
```typescript
onClick={() => setEditing({ 
  open: true, 
  entryId: entry.id, 
  initial: {
    taskId: entry.task_id,  // Sin cast "as any"
    hours: entry.hours,
    notes: entry.notes,
    date_iso: entry.date_iso,  // Sin cast "as any"
  }
})}
```

## Resultado esperado
Cuando abras el modal de edicion de una entrada, el campo "Tarea" mostrara correctamente la tarea que ya estaba asignada (ej: "Configuracion de la Base de Conocimientos (KB)" o "Implementacion"), permitiendote editar solo los campos que necesitas sin perder la asignacion de tarea existente.
