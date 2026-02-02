

# Plan: Aplicar estilo de Total Ajustado en el PDF

## Resumen
Actualizar la generación del PDF para que, cuando una factura tenga un valor en `adjusted_total`:
- El total original se muestre tachado y con fuente más pequeña (9pt en vez de 12pt)
- El total ajustado se muestre como el monto final

Este cambio aplicará automáticamente a todas las facturas existentes porque el valor se lee de la base de datos.

## Archivos a modificar

### 1. `src/lib/invoicePdf.ts`
- Agregar `adjustedTotal?: number` a la interfaz `InvoicePdfParams`
- Modificar la función `buildTotalsSection` para manejar el caso con total ajustado

### 2. `src/lib/invoice-styles.ts`
- Agregar nuevos estilos para el total original tachado con tamaño reducido

### 3. `src/components/billing/InvoiceDetail.tsx`
- Pasar el campo `adjusted_total` de la factura al generar el PDF
- Mostrar también el total ajustado en la vista del detalle de la factura

---

## Sección Técnica

### Cambios en `src/lib/invoicePdf.ts`

**Interface (línea 22):**
```typescript
interface InvoicePdfParams {
  // ... campos existentes
  total: number;
  adjustedTotal?: number;  // NUEVO
  notes?: string;
  // ...
}
```

**Función `buildTotalsSection` (líneas 355-366):**
Agregar lógica condicional:
```typescript
// Si hay adjusted_total, mostrar total original tachado
if (params.adjustedTotal) {
  totalsStack.push({
    columns: [
      { text: 'TOTAL ORIGINAL:', style: 'strikethroughLabel', width: 'auto' },
      { 
        text: currency(params.total), 
        style: 'strikethroughAmount',  // Nuevo estilo con tachado
        alignment: 'right', 
        width: 100,
      },
    ],
    margin: [0, 0, 0, 4],
  });
}

// Total final (usa adjustedTotal si existe, sino total)
totalsStack.push({
  columns: [
    { text: 'TOTAL ADEUDADO:', style: 'totalLabel', width: 'auto' },
    { 
      text: currency(params.adjustedTotal || params.total), 
      style: 'totalAmount', 
      alignment: 'right', 
      width: 100,
    },
  ],
});
```

### Cambios en `src/lib/invoice-styles.ts`

Agregar nuevos estilos:
```typescript
// Total tachado (cuando hay adjusted_total)
strikethroughLabel: {
  fontSize: 9,
  color: '#94a3b8',  // slate-400 (atenuado)
},
strikethroughAmount: {
  fontSize: 9,
  color: '#94a3b8',
  decoration: 'lineThrough',
},
```

### Cambios en `src/components/billing/InvoiceDetail.tsx`

**Línea 159 - Llamada a downloadInvoicePDF:**
```typescript
await downloadInvoicePDF({
  // ... campos existentes
  total: Number(invoice.total_amount),
  adjustedTotal: (invoice as any).adjusted_total 
    ? Number((invoice as any).adjusted_total) 
    : undefined,
  notes: invoice.notes || undefined,
  // ...
});
```

**Líneas 297-305 - Vista del detalle:**
Mostrar ambos totales cuando hay ajustado:
```tsx
<div className="flex justify-end">
  <div className="min-w-[200px] space-y-2">
    {(invoice as any).adjusted_total && (
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Total Original:</span>
        <span className="line-through">
          ${Number(invoice.total_amount).toFixed(2)}
        </span>
      </div>
    )}
    <div className="flex justify-between text-lg font-bold">
      <span>Total:</span>
      <span>
        ${Number((invoice as any).adjusted_total || invoice.total_amount).toFixed(2)}
      </span>
    </div>
  </div>
</div>
```

---

## Resultado esperado

### En el PDF:
- **Sin adjusted_total**: Solo muestra "TOTAL ADEUDADO: $28,470.00"
- **Con adjusted_total**: Muestra:
  - ~~TOTAL ORIGINAL: $28,470.00~~ (tachado, gris, 9pt)
  - TOTAL ADEUDADO: $5,907.50 (normal, 12pt)

### En la vista de detalle:
- **Sin adjusted_total**: Muestra el total normal
- **Con adjusted_total**: Muestra el total original tachado y pequeño, y debajo el total ajustado en grande

Esto aplicará inmediatamente a la factura existente cuando descargues el PDF nuevamente.

