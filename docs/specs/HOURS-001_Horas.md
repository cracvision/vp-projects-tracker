# HOURS-001 — Registro de horas por proyecto ("Entrar Horas" / "Ver Horas")

| Campo | Valor |
|---|---|
| App | VP Projects Tracker |
| Solicitado por | Carlos Acevedo, 2026-11-20 |
| Estado | Especificación v1 — plan y decisiones H-1 a H-6 **aprobados por Carlos (2026-11-20)** |
| Reemplaza a | [TIME-CLOCK-001](TIME-CLOCK-001_Ponchar.md) (Ponchar), que no se implementó |
| Ejecuta | Claude Code (rama `feat/time-clock`) |

## 1. Solicitud (textual)

> "Lo que necesito es que después de haber escogido el proyecto que haya un botón que diga "Entrar Horas"
> (para entrar fecha-día-cantidad de horas) y otro botón que diga "Ver Horas" para ver el listado de todas las
> entradas con sus cantidades individuales y el total."

Aclarado con Carlos: es un **registro aparte**. No toca "Registrar Trabajo Diario" (`daily_entries`) ni las facturas.
Los botones van **dentro de la página del proyecto**.

**Definición de hecho:** en la página de cada proyecto, una tarjeta "Horas" con el total registrado y dos botones:
"Entrar Horas" (fecha + horas + nota opcional) y "Ver Horas" (listado de todas las entradas del proyecto con su
cantidad y el total). Se puede editar y borrar cada entrada.

## 2. Alcance

**Incluido (v1):**
- Tarjeta **Horas** en `ProjectDetail` (mismo estilo que "Facturación"): total registrado + botones.
- **Entrar Horas:** diálogo con Fecha (por defecto hoy, con el día de la semana debajo), Horas y Nota opcional.
- **Ver Horas:** página `/project/:projectId/hours` con todas las entradas del proyecto, de la más reciente a la más
  antigua: fecha, día de la semana, horas, nota, editar y borrar. Total y número de entradas arriba.
- Editar una entrada (el mismo diálogo, con los datos cargados) y borrarla con confirmación (`AlertDialog`).

**Fuera de alcance (v1):**
- Filtros por rango en Ver Horas (H-4).
- Pasar estas horas a Trabajo Diario o a facturas.
- Cualquier cambio a tablas existentes.

## 3. Decisiones (aprobadas por Carlos, 2026-11-20)

| ID | Decisión |
|---|---|
| H-1 | Horas con **hasta 2 decimales**, **más de 0 y máximo 24** por entrada (p. ej. 7.5, 8.25). |
| H-2 | Se permiten **varias entradas el mismo día** en el mismo proyecto; se suman. |
| H-3 | Fecha: **hoy o cualquier día pasado**, nunca futuro. "Hoy" es la fecha de `America/Puerto_Rico`. |
| H-4 | Ver Horas **sin filtros** en v1: lista completa y total. |
| H-5 | Se quita Ponchar de la app (botón en Home y todo su código). TIME-CLOCK-001 queda como "reemplazada". |
| H-6 | Se eliminan de producción los objetos de Ponchar (`time_sessions`, `time_session_breaks`, sus funciones y triggers) en la misma migración que crea la tabla nueva, **después de comprobar con SELECT** que están vacíos o solo tienen ponches de prueba. |

## 4. Modelo de datos

Una tabla nueva. **Ninguna tabla existente cambia.**

### 4.1 `hour_entries`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `uuid` PK | `DEFAULT gen_random_uuid()` |
| `owner_uid` | `uuid NOT NULL` | `DEFAULT auth.uid()`, FK `auth.users(id) ON DELETE CASCADE` |
| `project_id` | `uuid NOT NULL` | FK `projects(id) ON DELETE CASCADE` |
| `work_date` | `date NOT NULL` | Fecha de calendario del trabajo |
| `hours` | `numeric(4,2) NOT NULL` | `CHECK (hours > 0 AND hours <= 24)` |
| `notes` | `text` | Opcional, máximo 2000 caracteres (CHECK) |
| `created_at` | `timestamptz NOT NULL` | `DEFAULT now()` |
| `updated_at` | `timestamptz NOT NULL` | `DEFAULT now()`, trigger `update_updated_at_column()` |

- Índice: `(project_id, work_date DESC)` (sirve al listado y al borrado en cascada del proyecto).
- Migración: `supabase/migrations/20261120204332_hour_entries.sql`.
- **RLS** habilitado, patrón de `invoices`: `SELECT` y `DELETE` si `owner_uid = auth.uid()`; `INSERT` y `UPDATE`
  además exigen que `project_id` sea un proyecto del usuario.
- La regla de fecha futura (H-3) se valida en el cliente; la base garantiza el rango de horas (CHECK) y la
  propiedad (RLS).
- La misma migración elimina los objetos de Ponchar (H-6). Es idempotente (`IF EXISTS` / `IF NOT EXISTS`).

## 5. Interfaz

- **Tarjeta Horas** (`ProjectDetail`, antes de "Facturación"): "Total registrado: X h · N entradas" y los botones
  **Entrar Horas** y **Ver Horas**.
- **Diálogo Entrar Horas / Editar horas:** Fecha (`input date`, `max` = hoy en PR), día de la semana debajo
  ("viernes, 20 de noviembre 2026"), Horas (`step 0.25`), Nota. Mensajes con `useToast`.
- **Página Ver Horas:** patrón de `AllEntries.tsx` (chequeo de sesión → `/auth`, header con botón atrás +
  `BrandLogo`, nombre del proyecto). Total arriba; lista con fecha, día, horas, nota y acciones.
- Horas mostradas con hasta 2 decimales.

## 6. Criterios de aceptación

1. En la página del proyecto aparece la tarjeta Horas con el total y los dos botones.
2. Entrar Horas guarda fecha + horas + nota; el total de la tarjeta se actualiza.
3. Horas ≤ 0, > 24, con más de 2 decimales o vacías se rechazan con un mensaje claro.
4. Una fecha futura se rechaza; una fecha pasada lejana se acepta.
5. Ver Horas muestra todas las entradas del proyecto (y solo de ese proyecto), de la más reciente a la más antigua,
   con fecha, día de la semana, horas y nota; el total es la suma exacta.
6. Editar una entrada cambia sus datos; borrarla pide confirmación y la quita; el total se recalcula.
7. Los datos sobreviven a recargar la página o cerrar el navegador.
8. `pg_policies` muestra las 4 políticas de `hour_entries`; RLS habilitado.
9. Facturación intacta: conteos y sumas de `daily_entries`, `invoices` e `invoice_items` iguales antes y después.
10. Los objetos de Ponchar ya no existen en la base.
11. `npm run build`, lint de los archivos tocados y `npm test` sin errores.

## 7. Pasos

1. Limpieza: quitar el código de Ponchar, marcar TIME-CLOCK-001 como reemplazada, esta spec.
2. Migración (`hour_entries` + eliminación de Ponchar): mostrar SQL → "aplícala" → verificar con SELECT →
   actualizar `types.ts`.
3. Interfaz: tarjeta Horas, diálogo, página Ver Horas, ruta, pruebas vitest.
4. Prueba completa, limpieza de datos de prueba, PR a `main`.
