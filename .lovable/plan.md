

# Diagnóstico: Error al guardar horas en exceso

## Causa

El console log muestra el error exacto:

```
Error: Valor fuera de rango (0.1-24)
```

En `ExcessHoursSection.tsx` línea 80, se llama `validateNumber(formData.hours, 0.1, 24)` con un máximo de **24 horas**. El usuario ingresó **200**, lo cual excede ese límite. La validación lanza una excepción que es capturada por el `catch` genérico, mostrando el toast "No se pudo registrar" sin indicar la causa real.

## Solución

### 1. Aumentar el límite máximo en `ExcessHoursSection.tsx`
Cambiar el máximo de 24 a un valor razonable para horas en exceso acumuladas (ej: 1000):

```typescript
hours: validateNumber(formData.hours, 0.1, 1000),
```

### 2. Mostrar el mensaje de error real al usuario
En el `catch`, usar el mensaje del error si es una instancia de `Error`:

```typescript
} catch (error: any) {
  if (import.meta.env.DEV) console.error("Excess hours error:", error);
  const msg = error instanceof Error ? error.message : "No se pudo registrar. Intenta nuevamente.";
  toast({ title: "Error", description: msg, variant: "destructive" });
}
```

### 3. Actualizar el `max` del input HTML para consistencia
Cambiar el atributo `max` del campo Horas de no tenerlo a incluir el nuevo límite, o simplemente remover restricciones innecesarias del HTML ya que la validación server-side lo maneja.

