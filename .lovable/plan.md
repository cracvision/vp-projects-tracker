
# Plan: Agregar campo "Total Despues de Ajuste"

## Resumen
Agregar un nuevo campo editable debajo del "Total" en el dialogo de creacion de facturas, permitiendote escribir manualmente un monto ajustado.

## Cambios a realizar

### 1. Base de datos
Agregar una nueva columna `adjusted_total` a la tabla `invoices`:
- Tipo: `numeric` (permite decimales)
- Nullable: `true` (el campo es opcional)
- Default: `null` (si no se especifica, queda vacio)

### 2. Interfaz de usuario
**Archivo:** `src/components/billing/CreateInvoiceDialog.tsx`

Agregar debajo del campo "Total" (linea 349):
- Un nuevo campo con etiqueta "Total Despues de Ajuste"
- Un Input de tipo texto (para permitir entrada manual de numeros con decimales)
- El campo mostrara un placeholder con el valor del total calculado como referencia

### 3. Logica de guardado
Modificar la funcion `handleCreate`:
- Incluir el valor de `adjustedTotal` en el payload de la factura
- Si el campo esta vacio, se guarda como `null`

---

## Seccion Tecnica

### Migracion SQL
```sql
ALTER TABLE public.invoices 
ADD COLUMN adjusted_total numeric DEFAULT NULL;
```

### Estado nuevo en el componente
```typescript
const [adjustedTotal, setAdjustedTotal] = useState("");
```

### Nuevo campo en la UI (despues de la linea 349)
```tsx
<div className="flex justify-between items-center text-lg">
  <Label htmlFor="adjusted-total">Total Despues de Ajuste:</Label>
  <Input
    id="adjusted-total"
    type="text"
    inputMode="decimal"
    className="w-32 text-right font-bold"
    placeholder={`$${totalAmount.toFixed(2)}`}
    value={adjustedTotal}
    onChange={(e) => setAdjustedTotal(e.target.value)}
  />
</div>
```

### Modificacion del payload al crear factura
```typescript
const { data: inv, error: invErr } = await supabase
  .from("invoices")
  .insert([{
    // ... campos existentes
    adjusted_total: adjustedTotal ? parseFloat(adjustedTotal) : null,
  }])
```

---

## Archivos afectados
- **Nueva migracion SQL** para agregar la columna `adjusted_total`
- `src/components/billing/CreateInvoiceDialog.tsx` - agregar campo editable

## Resultado esperado
Cuando abras el dialogo para crear una factura, debajo del total calculado veras un campo de texto donde puedes escribir manualmente el monto ajustado. Si lo dejas vacio, no se guardara ningun valor ajustado.
