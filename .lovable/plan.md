
## Problema (reformulado)
En la lista de “Entradas del Día” sí se muestra el nombre de la tarea asignada, pero al abrir el modal “Editar entrada” el campo **Tarea** aparece como **“Sin asignar”**. Esto provoca que, si guardas sin tocar ese campo, la entrada puede quedar desasignada.

## Do I know what the issue is?
Aún no al 100%, pero ya tenemos una señal clave: **la UI tiene la tarea embebida como `entry.tasks.name`, pero el valor que usa el Select (`task_id`) llega vacío** al abrir el modal. Esto sugiere que, por cómo está viniendo la respuesta del backend/cliente, **`task_id` no está disponible de forma confiable**, aunque el objeto relacionado `tasks` sí.

## Objetivo
Que el modal precargue la tarea correcta siempre, y que **nunca se pierda la asignación** a menos que tú explícitamente cambies el Select.

---

## Solución propuesta (robusta)
Vamos a usar como “fuente de verdad” el **id de la tarea** de dos formas, con fallback:

1) Preferir `entry.task_id` (FK directa)  
2) Si por cualquier motivo `task_id` viene `null/undefined`, usar `entry.tasks.id` (obtenido al pedir `tasks(id,name)`)

Y además agregaremos un pequeño “seguro” al guardar:
- Solo cambiaremos `task_id` si el usuario realmente tocó/cambió el campo “Tarea”.

---

## Cambios a implementar

### 1) `DailyEntriesList.tsx`: pedir `tasks(id,name)` y usar fallback para el `taskId`
**Archivo:** `src/components/project-detail/DailyEntriesList.tsx`

**Cambios:**
- Actualizar el `select(...)` para traer también el `id` del objeto embebido:
  - De: `select("*, tasks(name)")`
  - A: `select("*, tasks(id,name)")` (o un select más explícito si queremos reducir payload)
- Actualizar el tipo:
  - De: `tasks: { name: string } | null`
  - A: `tasks: { id: string; name: string } | null`
- Al abrir el modal (click al lápiz), inicializar así:
  - `taskId: entry.task_id ?? entry.tasks?.id ?? null`

Esto hará que aunque `task_id` no venga, el modal tenga el id correcto y el Select lo muestre.

### 2) `EditEntryDialog.tsx`: evitar desasignar si el usuario no tocó el campo “Tarea”
**Archivo:** `src/components/project-detail/EditEntryDialog.tsx`

**Cambios:**
- Agregar estado `taskTouched` (boolean) que inicia en `false`.
- En `onValueChange` del Select:
  - marcar `taskTouched = true`
  - actualizar `form.taskId`
- En `onSubmit`:
  - Si `taskTouched === false`, usar el `initial.taskId` tal cual (mantiene la tarea actual).
  - Si `taskTouched === true`, entonces sí aplicar la lógica actual:
    - `"none"` ⇒ `null`
    - `uuid` ⇒ ese uuid

Con esto, aunque hubiera alguna condición rara donde el Select se muestre mal, **guardar “Horas” o “Notas” no debería borrar la tarea** a menos que tú cambies ese campo.

---

## Validación / pruebas (manuales)
1) Ir a un día donde la lista muestre claramente una tarea (nombre visible en la tarjeta).
2) Clic en el lápiz:
   - El modal debe abrir mostrando esa misma tarea (no “Sin asignar”).
3) Sin cambiar “Tarea”, editar solo “Notas” y guardar:
   - Reabrir el modal y confirmar que la tarea sigue asignada.
4) Cambiar explícitamente a “Sin asignar” y guardar:
   - Reabrir y confirmar que ahora sí quedó desasignada.

---

## Consideraciones y riesgos
- Esto no requiere cambios en base de datos ni políticas de acceso.
- Si el backend deja de devolver `tasks.id` por configuración, el fallback se rompe; por eso mantenemos también `task_id` cuando esté disponible.
- Si existieran múltiples relaciones hacia `tasks` (no parece el caso), podríamos necesitar especificar el nombre de la relación en el `select`, pero con el esquema actual debería funcionar.

---

## Archivos afectados
- `src/components/project-detail/DailyEntriesList.tsx`
- `src/components/project-detail/EditEntryDialog.tsx`
