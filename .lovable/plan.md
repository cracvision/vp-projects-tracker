

# Plan: Mejorar factura PDF — Total de horas y formato de notas

## Cambio 1: Agregar total de horas en la sección de totales

**`src/lib/invoicePdf.ts`** — en `buildTotalsSection`, calcular la suma total de horas y agregar una línea "Total Horas:" antes del subtotal monetario:

```typescript
const totalHours = params.items.reduce((sum, item) => sum + item.hours, 0);

totalsStack.push({
  columns: [
    { text: 'Total Horas:', style: 'subtotalLabel', width: 'auto' },
    { text: totalHours.toFixed(2), style: 'subtotalAmount', alignment: 'right', width: 100 },
  ],
  margin: [0, 0, 0, 4],
});
```

Esto se insertará como primer elemento del `totalsStack`, antes de "Subtotal:".

## Cambio 2: Preservar saltos de línea en las notas

**`src/lib/invoicePdf.ts`** — en `buildNotesSection`, dividir el texto por `\n` y generar un elemento por cada línea para preservar el formato original:

```typescript
function buildNotesSection(notes: string): Content {
  const lines = notes.split('\n').map(line => ({
    text: line || ' ',  // espacio para líneas vacías
    style: 'normalText',
    margin: [0, 0, 0, 2] as [number, number, number, number],
  }));

  return {
    stack: [
      { text: 'NOTAS:', style: 'sectionHeader', margin: [0, 10, 0, 5] },
      ...lines,
    ],
    margin: [0, 0, 0, 15],
  };
}
```

Esto mantendrá cada línea separada tal como fue ingresada, en lugar de colapsar todo en un solo párrafo.

