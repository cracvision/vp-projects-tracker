# Bug: "Editar entrada" muestra "Sin asignar" aunque la entrada sí tenga una Tarea

## Causa raíz

`EditEntryDialog` carga la lista de tareas del proyecto **después** de que el diálogo se abre (dentro de un `useEffect` que depende de `open`). Mientras esa petición está en curso:

- El `<Select>` tiene `value = initial.taskId` (un UUID válido), pero todavía no existe ningún `<SelectItem>` con ese valor, por lo que Radix muestra el placeholder **"Sin asignar"**.
- El usuario percibe que la tarea quedó vacía. Si hace clic en el Select para "verificarla" y selecciona algo (incluso la misma), se dispara `taskTouched=true` y la lógica de guardado deja de preservar la tarea original.
- Además, cualquier guardado hecho antes de que terminen de cargar las tareas se ve sospechoso al usuario aunque el `taskTouched` guard normalmente preserve el valor.

El guard `taskTouched` ya existe y es correcto; el problema es puramente de **visualización inicial**: las tareas deben estar disponibles antes (o en el mismo tick) en que se abre el diálogo.

## Cambios

**`src/components/project-detail/EditEntryDialog.tsx`**

1. Cambiar el `useEffect` de carga de tareas para que dependa de `projectId` únicamente (no de `open`), de modo que las tareas se carguen al montar el componente. El diálogo está siempre montado en `DailyEntriesList`, así que cuando el usuario haga clic en el lápiz, la lista ya estará disponible y el `<Select>` mostrará el nombre real de la tarea.
2. Ajustar el `useEffect` que sincroniza `form` con `initial` para que también se ejecute cuando `open` cambia a `true` (además de cuando cambia `initial`), garantizando que cada vez que se abra el diálogo el estado se reinicialice desde cero (taskId correcto + `taskTouched=false`).
3. Como red de seguridad: si las tareas aún no incluyen el `initial.taskId` por cualquier motivo, inyectar dinámicamente un `<SelectItem>` "fantasma" usando el nombre que ya conocemos vía prop, de modo que el Select nunca caiga al placeholder cuando hay tarea asignada.

**`src/components/project-detail/DailyEntriesList.tsx`**

- Pasar `taskName: entry.tasks?.name ?? null` dentro de `initial` para que EditEntryDialog pueda renderizar la opción fantasma del punto 3.

**`EditEntryDialog` props** — extender el tipo `initial` con `taskName?: string | null` (opcional, retrocompatible).

## Qué NO se cambia

- La lógica de guardado (`onSubmit`) y el `taskTouched` guard se mantienen tal cual; ya son correctas.
- No se toca el esquema de DB ni ningún otro componente.

## Validación

1. Abrir un proyecto con entradas que tengan tarea asignada.
2. Hacer clic en el lápiz de una entrada → el Select debe mostrar el nombre real de la tarea inmediatamente (no "Sin asignar").
3. Pulsar **Guardar** sin tocar nada → la tarea sigue asignada.
4. Cambiar la tarea manualmente y guardar → se actualiza al nuevo valor.
5. Seleccionar "Sin asignar" manualmente y guardar → queda sin asignar (comportamiento explícito del usuario).
