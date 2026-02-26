

# Plan: Mejorar descripción de items de exceso en factura

## Problema
En `CreateInvoiceDialog.tsx` línea 163, cuando una entrada es de tipo `excess`, `e.tasks` es null y el fallback es "Trabajo", lo cual no es descriptivo.

## Cambio

### `src/components/billing/CreateInvoiceDialog.tsx` (línea 163)
Cambiar:
```typescript
const taskName = e.tasks?.name || "Trabajo";
```
Por:
```typescript
const taskName = e.tasks?.name || (e.entry_type === "excess" ? "Horas en exceso" : "Trabajo");
```

Y en línea 170, el `task_name`:
```typescript
task_name: e.tasks?.name || (e.entry_type === "excess" ? "Horas en exceso" : null),
```

Esto es un cambio de 2 líneas. El resto del flujo (InvoiceDetail, PDF) ya funciona correctamente con los datos que recibe.

