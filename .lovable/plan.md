
## Assessment de impacto

Revisé los archivos involucrados. Resumen de qué se toca y qué NO se rompe:

- **`adjusted_total`** se usa en: `CreateInvoiceDialog` (input), `InvoiceDetail` (display + envío al PDF), `invoicePdf.ts` (renderiza tachado), `invoice-styles.ts` (estilo tachado), y la columna existe en DB. Solo eliminamos la **UI de entrada** en CreateInvoiceDialog. Mantenemos columna DB, lógica de PDF y display en InvoiceDetail por compatibilidad con facturas históricas (#0005 ya creada). Esto es seguro: no se está borrando data.
- **`Est. (max)` y `Progreso`** en Reporte de Estado solo se usan en `reports.ts` (`generateStatusReportPdf`). El cálculo `overallProgress` en `ReportsSection.tsx` deja de necesitarse. Tasks siguen guardando `estimated_hours_max` / `progress` (se usan en `TaskTable`, no se tocan).
- **InvoiceDetail como Sheet**: solo usado desde `ProjectBilling.tsx`. Convertirlo a página requiere nueva ruta + cambiar navegación. Sin otros consumidores.
- **Reporte Diario rango de fechas**: hoy filtra por una sola fecha. Cambio aislado a `ReportsSection.tsx` + `generateDailyReportPdf` en `reports.ts`.

Nada de esto rompe facturas, tareas, o entradas existentes.

---

## Cambios

### 1. Reporte de Estado (`src/lib/reports.ts` + `ReportsSection.tsx`)

En `generateStatusReportPdf`:
- Tabla "Detalle por tarea": eliminar columnas `Est. (max)` y `Progreso`. Dejar solo `Tarea` y `Horas Trabajadas` (renombrado de "Horas reales"). Ajustar `widths` a `['*', 80]`.
- Eliminar el bloque que renderiza `Progreso general (sobre tareas estimadas): X%`.
- Eliminar parámetro `overallProgress` de la firma (o ignorarlo).

En `ReportsSection.tsx`:
- Eliminar el cálculo de `overall` / `totalsFromTasks` (ya no se necesita).
- No pasar `overallProgress` a la función.

### 2. Reporte Diario — rango de fechas (`ReportsSection.tsx` + `reports.ts`)

UI:
- Reemplazar el único input `date` por dos inputs: "Desde" y "Hasta". Default: ambos = hoy (comportamiento equivalente al actual cuando son iguales).

Lógica `generateDaily`:
- Query: `.gte("date_iso", startDate).lte("date_iso", endDate)` y ordenar por `date_iso` luego `created_at`.

`generateDailyReportPdf`:
- Cambiar firma: aceptar `startDate` + `endDate` en vez de `date`.
- Título de sección:
  - Si `startDate === endDate`: `Entradas del día — {fecha}` (igual que hoy).
  - Si no: `Entradas del {startDate} al {endDate}`.
- Cuando es rango, agrupar entradas por fecha con un subtítulo por día (manteniendo el formato actual de cada entrada). Subtotales por día + total general.
- Nombre del archivo: `reporte-diario-{proyecto}-{start}_a_{end}-{timestamp}.pdf` (o usar la fecha única cuando coinciden).

### 3. Facturas — vista full page (`ProjectBilling.tsx` + `InvoiceDetail.tsx` + `App.tsx`)

- Crear nueva ruta `/project/:projectId/billing/:invoiceId` en `App.tsx`, apuntando a un nuevo page `InvoiceDetailPage`.
- `InvoiceDetailPage` (nuevo, `src/pages/InvoiceDetailPage.tsx`): obtiene `invoiceId` de params, renderiza el contenido actual de `InvoiceDetail` pero como página completa (header con botón "Volver a Facturación", layout en `container mx-auto py-8`, sin `Sheet`).
- Refactor: extraer el contenido interno de `InvoiceDetail.tsx` a `InvoiceDetailView` (sin `Sheet`), reutilizado por la página. El componente `InvoiceDetail` (con Sheet) deja de usarse y se elimina junto con su importación en `ProjectBilling.tsx`.
- `ProjectBilling.tsx`: en lugar de `setSelectedInvoiceId`, el botón "Ver" hace `navigate(\`/project/${projectId}/billing/${invoice.id}\`)`. Eliminar estado `selectedInvoiceId` y el render de `<InvoiceDetail />`.

### 4. Crear Factura — eliminar "Total Después de Ajuste" (`CreateInvoiceDialog.tsx`)

- Eliminar el estado `adjustedTotal`, el input "Total Después de Ajuste", y la propiedad `adjusted_total` del payload del insert (queda `NULL` por defecto en DB).
- Limpiar también de los `reset` al cerrar/crear.

### Fuera de scope (intencional)

- No se borra la columna `adjusted_total` ni se quita el rendering tachado en `invoicePdf.ts` / `invoice-styles.ts` / `InvoiceDetail` — preserva facturas viejas.
- No se modifica el cálculo de progreso o estimados en tasks (siguen visibles en `TaskTable` del proyecto).
- No se renombra "Horas reales" en otros lugares (solo en el PDF de Reporte de Estado, que es lo pedido).

### Detalles técnicos clave

- Para el rango de fechas en PDF: usar `ymdToLocalDate` consistentemente (regla del proyecto: prevenir offset UTC).
- Cuando `startDate > endDate`, mostrar toast de error y no generar.
- Nueva ruta debe ir dentro de la sección autenticada en `App.tsx` (mismo wrapper que `/project/:projectId/billing`).
