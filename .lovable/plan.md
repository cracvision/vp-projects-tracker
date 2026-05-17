# Plan: Corregir truncado real del PDF — tokens largos en Descripción

## Diagnóstico revisado

El cambio anterior de anchos (`['*', 55, 40, 65, 80]`) era correcto en teoría, pero el problema real **no son los anchos**: es que la columna **Descripción** contiene tokens largos sin espacios (nombres de archivo tipo `PDD_Proceso_Referencia_Acetaminofen_500mg.docx`, `PDD_Draft_System_Architecture_Spec_v0_1.docx`, IDs como `ACT-500-TR-001`, etc.).

pdfmake **no parte palabras largas automáticamente**. Cuando el token excede el ancho asignado a `*`, pdfmake expande visualmente el contenido y la tabla se desborda hacia la derecha, empujando "Importe" fuera del área imprimible y cortándolo en el borde de la página. Por eso aumentar el ancho de Importe a 80 no resolvió nada: la tabla entera se corre hacia la derecha por culpa de la descripción.

Evidencia en la captura: el header "Importe" aparece como "Imp" y los valores como "USD 18(" — están cortados exactamente en el borde derecho de la página, no por falta de ancho de columna sino porque la tabla se extiende más allá del margen.

## Cambio propuesto

En `src/lib/invoicePdf.ts`, dentro de `buildServicesTable`, agregar una función helper que inserte **zero-width spaces** (`\u200B`) dentro de tokens largos (>20 caracteres) de la descripción, permitiendo que pdfmake los parta en cualquier punto sin alterar visualmente el texto.

```ts
function softWrap(text: string, maxTokenLen = 20): string {
  return text.split(/(\s+)/).map(token => {
    if (token.length <= maxTokenLen || /\s/.test(token)) return token;
    // Insertar zero-width space cada N chars en tokens largos
    return token.match(new RegExp(`.{1,${maxTokenLen}}`, 'g'))?.join('\u200B') ?? token;
  }).join('');
}
```

Aplicarlo al renderizar la celda de descripción:

```ts
{ 
  text: softWrap(item.description), 
  style: index % 2 === 0 ? 'tableCell' : 'tableCellAlt',
},
```

## Anchos de columna

Mantener `['*', 55, 40, 65, 80]` (suma fija 240pt, descripción ~275pt). Son correctos una vez que la descripción ya no fuerza overflow.

## Sin cambios adicionales

- No se toca `invoice-styles.ts`, paddings, ni totales.
- El zero-width space es invisible al usuario: copiar/pegar el PDF mantiene el texto legible (puede dejar un caracter invisible entre fragmentos, pero no altera el significado).
- No cambia el backend ni los datos almacenados; solo el render.

## Verificación

Regenerar la factura #0005 (la de la captura) y confirmar:
1. "Importe" aparece completo en el header.
2. Los valores tipo "USD 180.00" se ven completos.
3. Los nombres de archivo largos hacen wrap dentro de la celda de descripción.
