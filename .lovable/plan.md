# Plan: Corregir truncado de la columna "Importe" en factura PDF

## Diagnóstico

En `src/lib/invoicePdf.ts` → `buildServicesTable`, los anchos son:

```ts
widths: ['*', 60, 45, 55, 65]
//      Desc, Fecha, Horas, Tarifa, Importe
```

Con `pageMargins: [40, 50, 40, 60]` sobre página por defecto (A4 = 595pt), el ancho útil es ~515pt. Las columnas fijas suman 225pt y cada celda tiene `paddingLeft/Right = 8` (16pt internos).

La columna **Importe** sólo tiene 65pt de ancho total → ~49pt para contenido. Valores como `USD 12,150.00` (13 caracteres) no caben y pdfmake los corta visualmente en el borde derecho (como se ve en la captura: "USD 450.0" sin el último "0", y el header "Importe" también truncado).

No existe doc específica del layout de factura en el repo más allá del propio `invoicePdf.ts` e `invoice-styles.ts`; el resto son specs de negocio (numeración, due dates, etc.).

## Cambio

En `src/lib/invoicePdf.ts`, ajustar los anchos para dar espacio suficiente a Tarifa e Importe (que muestran montos con prefijo "USD" y separador de miles) y reducir las columnas que sí sobran:

```ts
widths: ['*', 55, 40, 65, 80]
//      Desc, Fecha, Horas, Tarifa, Importe
```

Justificación:
- **Importe**: 65 → **80** (cabe "USD 99,999.00" con padding).
- **Tarifa**: 55 → **65** (cabe "USD 1,000.00" cómodo).
- **Horas**: 45 → **40** (los valores son `0.00`–`999.99`, sobra espacio).
- **Fecha**: 60 → **55** (formato `dd/mm/yyyy` = 10 chars, cabe).
- **Descripción** (`*`): absorbe el resto automáticamente, pierde ~10pt pero sigue siendo la columna dominante.

Suma fija nueva: 240pt (vs 225pt actuales) → descripción ~275pt, sigue siendo amplia para texto multi-línea (ya está configurada para no truncar).

## Sin cambios adicionales

- No se toca `invoice-styles.ts`, paddings, ni el alineamiento `right` de las columnas numéricas.
- No se toca la sección de totales (que se ve correcta en la captura).
- No requiere migración ni cambios de backend.

## Verificación

Generar una factura de prueba con montos grandes (>10,000) y confirmar visualmente que ni el header "Importe" ni los valores se cortan.
