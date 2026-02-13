
# Plan: Corregir el guardado del Total Después de Ajuste

## Problema encontrado

El campo "Total Después de Ajuste" no se guardó correctamente en la factura #0003. La base de datos muestra:

| Factura | total_amount | adjusted_total |
|---------|-------------|----------------|
| #0003   | $3,932.50   | NULL           |

**Causa raíz:** Cuando el usuario escribe un valor como `$1,700.00` en el campo, el código usa `parseFloat("$1,700.00")` que retorna `NaN` porque `parseFloat` no puede interpretar el signo `$` ni las comas. Ese `NaN` se guarda como `null` en la base de datos.

## Solución

### 1. Limpiar el input antes de hacer parseFloat (en `CreateInvoiceDialog.tsx`)

Modificar la linea 146 para eliminar caracteres no numericos (`$`, `,`, espacios) antes de convertir:

```typescript
// Antes (linea 146):
adjusted_total: adjustedTotal ? parseFloat(adjustedTotal) : null,

// Después:
adjusted_total: adjustedTotal 
  ? parseFloat(adjustedTotal.replace(/[^0-9.]/g, '')) || null 
  : null,
```

### 2. Actualizar la factura #0003 en la base de datos

Ejecutar una consulta SQL para corregir el valor que no se guardó:

```sql
UPDATE invoices 
SET adjusted_total = 1700.00 
WHERE invoice_number = 3;
```

## Resultado esperado

- La factura #0003 mostrara el total original ($3,932.50) tachado y el total ajustado ($1,700.00) como monto final
- Futuras facturas aceptaran valores con `$`, comas, o solo numeros sin problemas
