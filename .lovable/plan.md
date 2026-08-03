# Crear tarea nueva desde "Registrar Trabajo Diario"

## Qué se agrega

En el dropdown de **Tarea** del formulario "Registrar Trabajo Diario" se añade una opción al final: **"+ Crear nueva tarea…"**.

Al seleccionarla:
1. Se abre el mismo diálogo de "Crear Nueva Tarea" que ya existe en la página de Tareas del Proyecto (nombre, descripción, horas mín/máx opcionales).
2. Al guardar, la tarea queda guardada permanentemente en el proyecto (aparece también en "Tareas del Proyecto").
3. El dropdown se recarga y la nueva tarea queda **seleccionada automáticamente** para esa entrada de trabajo.
4. Si se cancela el diálogo, el dropdown vuelve al valor que tenía antes ("Sin asignar" u otra tarea), sin perder lo ya escrito en horas/notas.

La nueva tarea entra al final del orden de tareas (mismo `display_order` automático de hoy), así que el orden del dropdown sigue igual al del acordeón de Tareas del Proyecto.

## Detalles técnicos

- `CreateTaskDialog.tsx`: el insert pasa a usar `.select("id").single()` y `onTaskCreated` recibe el id de la tarea creada (opcional, para no romper el uso actual en `TaskSection`). Se agrega prop opcional `defaultName` para precargar el nombre.
- `DailyWorkLog.tsx`:
  - `SelectItem` con valor centinela `__new__` al final de la lista.
  - `onValueChange`: si el valor es `__new__`, no se guarda en `formData.taskId`; se abre el diálogo.
  - Al crearse la tarea: `fetchTasks()` y `setFormData({ ...formData, taskId: nuevoId })`.
  - Se renderiza `<CreateTaskDialog />` dentro de `DailyWorkLog`.
- Sin cambios de base de datos ni de reglas de acceso.
