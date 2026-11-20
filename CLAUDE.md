# CLAUDE.md — VP Projects Tracker

## Qué es

Aplicación personal de Carlos Acevedo (Vista Pelícano LLC) para gestionar proyectos de consultoría:
proyectos, tareas, registro de trabajo diario (`daily_entries`) y facturación (`invoices`, `invoice_items`)
con PDF de factura. Las facturas que salen de aquí se envían a clientes reales: **los datos son de producción
y tienen valor fiscal.**

- Interfaz en **español**. Identificadores de código en inglés.
- Un solo usuario (Carlos), autenticado con Supabase Auth (email + contraseña).

## Stack

React 18.3 · Vite 5 · TypeScript 5.8 · Tailwind 3 · shadcn/ui · TanStack Query 5 · React Router 6 ·
supabase-js 2 · date-fns 3 (locale `es`) · pdfmake (PDF de factura, `src/lib/invoicePdf.ts`).

Backend: **Lovable Cloud** (Supabase gestionado por Lovable). No hay conexión directa a Postgres ni
`supabase link`; no hay edge functions en el repo.

## Comandos

```bash
npm install
npm run dev      # Vite en http://localhost:8080
npm run build
npm run lint
```

## ⚠ La base de datos local ES la de producción

`.env` (versionado por Lovable) apunta al Supabase de Lovable Cloud. `npm run dev` lee y escribe **los datos
reales** (facturas emitidas incluidas). Por tanto:

- Nunca ejecutes ni propongas `UPDATE`, `DELETE`, `INSERT` ni `TRUNCATE` sobre tablas existentes
  (`projects`, `tasks`, `daily_entries`, `invoices`, `invoice_items`, `invoice_counters`, `profiles`, `reports`).
- No toques la numeración de facturas (`next_invoice_number`, `set_invoice_number`, `invoice_counters`).
- Las funcionalidades nuevas escriben **solo en tablas nuevas** salvo aprobación explícita de Carlos.
- Para probar, crea datos de prueba en las tablas nuevas y bórralos al terminar.

## Cambios de esquema (DDL)

1. Escribe la migración como archivo nuevo en `supabase/migrations/` (`YYYYMMDDHHMMSS_<nombre>.sql`).
2. La migración debe ser **idempotente** (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`,
   `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`). Puede llegar a aplicarse dos veces.
3. Toda tabla nueva lleva **RLS habilitado** y políticas por `auth.uid()`, siguiendo el patrón de `invoices`.
4. **No apliques DDL por tu cuenta.** Muestra el SQL, espera a que Carlos diga "aplícala", y solo entonces
   aplícalo con el MCP de Lovable (`query_database`) o Carlos lo pega en el SQL editor de Lovable Cloud.
5. Después de aplicar, verifica con `SELECT` (tablas, columnas, políticas, triggers) y reporta el resultado.
6. Actualiza `src/integrations/supabase/types.ts` a mano para las tablas nuevas, con el mismo formato que el
   archivo generado (Row / Insert / Update / Relationships). Lovable lo regenera desde la base después;
   si su versión difiere, se acepta la de Lovable.

## MCP de Lovable (si está conectado)

- Permitido: `list_files`, `read_file`, `grep_files`, `get_project`, y `query_database` **solo con SELECT**,
  más el DDL aprobado según la sección anterior.
- Prohibido: `send_message` (el agente de Lovable editaría el mismo repo en paralelo y diverge el sync),
  `deploy_project`, y cualquier SQL que modifique datos existentes. `query_database` corre con privilegios
  que **saltan RLS**: trátalo como acceso de administrador.

## Git y sync con Lovable

- El repo tiene sync bidireccional con Lovable sobre la rama `main`: lo que llega a `main` aparece en Lovable.
- Trabaja siempre en una rama de feature (`feat/<nombre>`). Nunca hagas push directo a `main` ni `--force`.
- Carlos revisa y fusiona a `main`. Mientras haya una feature abierta, Carlos no edita en Lovable.
- Después del merge, la app publicada (`vp-projects-tracker.lovable.app`) se actualiza cuando Carlos pulsa
  **Publish → Update** en Lovable.
- No modifiques `src/integrations/supabase/client.ts` ni `previewAuthStorage.ts` (generados por Lovable).
- Nunca guardes secretos en el repo. `.env` solo contiene la URL y la clave publicable.

## Convenciones del código

- Página nueva: sigue el patrón de `src/pages/AllEntries.tsx` (chequeo de sesión con
  `supabase.auth.getSession()` → `/auth`, header con botón atrás + `BrandLogo`, `container mx-auto`, `Card`s).
- Rutas en `src/App.tsx`, siempre **encima** del catch-all `*`.
- Cliente: `import { supabase } from "@/integrations/supabase/client"`.
- Fechas de calendario como texto `YYYY-MM-DD` (`date_iso`); para mostrarlas usa `ymdToLocalDate` de `src/lib/date.ts`.
- Zona horaria del usuario: `America/Puerto_Rico` (UTC−4, sin horario de verano). Centralízala en una constante.
- Mensajes con `useToast` (`@/hooks/use-toast`), igual que el resto de la app.
- Validación con `src/lib/validation.ts`.
- Confirmación de borrado con `AlertDialog`, como en `AllEntries.tsx`.

## Documentación del repo

- `ESPECIFICACION_TECNICA.md` es de octubre 2025 y está **parcialmente desactualizada**
  (dice html2pdf: hoy es pdfmake; describe la edge function `improve-notes`: ya no existe; no incluye
  `daily_entries.entry_type`, `invoices.adjusted_total`, `ProjectPhases` ni `AllEntries`).
  **El código y `supabase/migrations/` son la fuente de verdad.**
- Especificaciones de features nuevas: `docs/specs/`.

## Cómo trabajar con Carlos

- Responde en español, directo y técnico. Carlos no es programador de profesión pero entiende React,
  TypeScript, Supabase y RLS: no simplifiques de más, pero explica lo que no sea obvio.
- Para cualquier feature: **plan primero** (archivos, esquema, riesgos) y espera aprobación antes de editar.
- Una cosa a la vez. Al terminar cada paso, di qué archivos cambiaste y qué probar, en pasos numerados
  (una línea por paso).
- Si algo tiene riesgo para los datos de facturación, dilo sin rodeos antes de hacerlo.
- Antes de decir "listo": `npm run build` y `npm run lint` sin errores.
