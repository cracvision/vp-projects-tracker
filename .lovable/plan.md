

# Plan: Horas Trabajadas en Exceso No Facturadas

## Concepto

Agregar un campo `entry_type` a la tabla `daily_entries` para distinguir entre entradas regulares y horas en exceso. Esto permite reutilizar toda la infraestructura existente de facturación sin duplicar tablas.

## Cambios

### 1. Migración de base de datos
Agregar columna `entry_type` (tipo `text`, default `'regular'`) a `daily_entries`. Valores posibles: `'regular'` y `'excess'`.

### 2. Nueva sección en la vista del proyecto (`ProjectDetail.tsx`)
Debajo de "Tareas del Proyecto", agregar una card "Horas en Exceso No Facturadas" con:
- Formulario simple: fecha, horas, descripción/notas
- Sin selector de tarea (no aplica)
- Lista de entradas de tipo `excess` registradas
- Las entradas se guardan en `daily_entries` con `task_id = null` y `entry_type = 'excess'`

### 3. Componente `ExcessHoursSection.tsx`
Nuevo componente con:
- Formulario para registrar horas en exceso (fecha, horas, notas)
- Lista de horas en exceso registradas (filtradas por `entry_type = 'excess'`)
- Indicador visual de cuáles ya fueron facturadas vs pendientes

### 4. Actualizar `CreateInvoiceDialog.tsx`
- Al cargar entradas sin facturar, incluir también las de tipo `excess`
- Mostrarlas en una sección separada o con un badge visual para diferenciarlas de las regulares
- El usuario puede seleccionar entradas excess para incluirlas en la factura

### 5. Actualizar `DailyWorkLog.tsx`
- Filtrar entradas regulares (`entry_type = 'regular'` o `NULL`) para que las excess no aparezcan mezcladas en el log diario normal

## Resultado
- Sección dedicada para documentar horas en exceso sin asignarlas a tareas
- Al crear factura, las horas en exceso aparecen como entradas seleccionables
- Separación visual clara entre trabajo regular y horas en exceso

