

# Plan: Cambiar tamaños de fuente condicionalmente

## Resumen
Modificar los tamaños de fuente del "Total" original y del "Total Después de Ajuste" de forma condicional:
- **Sin valor ajustado**: Total original mantiene tamaño grande (text-lg ≈ 18px)
- **Con valor ajustado**: Total original reduce a tamaño pequeño (text-xs ≈ 12px) y el campo de ajuste también usa tamaño pequeño

## Cambios a realizar

### Archivo a modificar
`src/components/billing/CreateInvoiceDialog.tsx`

### Cambios específicos

**Línea 349 - Total original:**
Cambiar la clase `text-lg` a una clase condicional que use `text-xs` cuando haya un valor ajustado.

**Línea 355 - Total Después de Ajuste:**
Cambiar la clase `text-lg` a `text-xs` para que el campo de ajuste siempre tenga el tamaño pequeño (11px aprox).

---

## Sección Técnica

### Código actual (líneas 349-366)
```tsx
<div className="flex justify-between text-lg font-bold">
  <span>Total:</span>
  <span className={adjustedTotal ? "line-through text-muted-foreground" : ""}>
    ${totalAmount.toFixed(2)}
  </span>
</div>
<div className="flex justify-between items-center text-lg">
  <Label htmlFor="adjusted-total">Total Después de Ajuste:</Label>
  <Input ... />
</div>
```

### Código modificado
```tsx
<div className={`flex justify-between font-bold ${adjustedTotal ? "text-xs" : "text-lg"}`}>
  <span>Total:</span>
  <span className={adjustedTotal ? "line-through text-muted-foreground" : ""}>
    ${totalAmount.toFixed(2)}
  </span>
</div>
<div className="flex justify-between items-center text-xs">
  <Label htmlFor="adjusted-total">Total Después de Ajuste:</Label>
  <Input
    ...
    className="w-32 text-right font-bold text-xs"
  />
</div>
```

### Nota sobre tamaños en Tailwind
- `text-lg` = 1.125rem ≈ 18px (tamaño original)
- `text-xs` = 0.75rem ≈ 12px (cercano a 11px que solicitas)
- `text-sm` = 0.875rem ≈ 14px (alternativa intermedia)

Si prefieres exactamente 11px, puedo usar una clase personalizada `text-[11px]`.

## Resultado esperado
- Sin valor en "Total Después de Ajuste": El total se muestra grande (18px)
- Con valor en "Total Después de Ajuste": El total original se reduce (12px), se tacha, y el campo de ajuste también aparece pequeño (12px)

