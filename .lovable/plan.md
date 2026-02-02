

# Plan: Agregar strikethrough condicional al Total original

## Resumen
Aplicar un estilo de tachado (strikethrough) al monto del "Total" cuando se ingrese un valor en el campo "Total Después de Ajuste". Esto indica visualmente que el total original ha sido reemplazado por el ajustado.

## Cambios a realizar

### Archivo a modificar
`src/components/billing/CreateInvoiceDialog.tsx`

### Cambio especifico
En la linea 351 donde se muestra el total (`<span>${totalAmount.toFixed(2)}</span>`), agregar una clase CSS condicional que aplique `line-through` y opcionalmente `text-muted-foreground` cuando el campo `adjustedTotal` tenga un valor.

---

## Seccion Tecnica

### Codigo actual (lineas 349-351)
```tsx
<div className="flex justify-between text-lg font-bold">
  <span>Total:</span>
  <span>${totalAmount.toFixed(2)}</span>
</div>
```

### Codigo modificado
```tsx
<div className="flex justify-between text-lg font-bold">
  <span>Total:</span>
  <span className={adjustedTotal ? "line-through text-muted-foreground" : ""}>
    ${totalAmount.toFixed(2)}
  </span>
</div>
```

## Resultado esperado
- Sin valor en "Total Después de Ajuste": El total se muestra normal ($130.00)
- Con valor en "Total Después de Ajuste": El total aparece tachado y atenuado (~~$130.00~~)

