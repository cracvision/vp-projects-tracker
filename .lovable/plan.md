

# Plan: Actualizar factura existente con Total Ajustado

## Situación actual

La factura #0002 tiene el campo `adjusted_total` en NULL porque fue creada antes de implementar esta funcionalidad:

| Campo | Valor actual |
|-------|-------------|
| invoice_number | 2 |
| total_amount | $28,470.00 |
| adjusted_total | NULL ← vacío |

El código ya está listo y funcionando. Solo falta el dato en la base de datos.

## Solución

Actualizar el registro de la factura #0002 para agregar el valor de `adjusted_total = 5907.50` (el valor que veo en tu captura de pantalla).

## Acción a realizar

Ejecutar esta actualización en la base de datos:

```sql
UPDATE invoices 
SET adjusted_total = 5907.50 
WHERE invoice_number = 2;
```

## Resultado esperado

Una vez actualizada la base de datos:

**En la vista de detalle de la factura:**
- Aparecerá "Total Original: ~~$28,470.00~~" (tachado, pequeño)
- Aparecerá "Total: $5,907.50" (grande, negrita)

**En el PDF descargado:**
- Aparecerá "TOTAL ORIGINAL: ~~USD 28,470.00~~" (tachado, gris, 9pt)
- Aparecerá "TOTAL ADEUDADO: USD 5,907.50" (normal, negrita)

## Nota importante

Este paso manual solo es necesario para facturas creadas antes de la implementación. Las facturas nuevas que crees con un valor en "Total Después de Ajuste" ya funcionarán automáticamente.

