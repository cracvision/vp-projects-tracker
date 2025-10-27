-- 1) Contador seguro por usuario (PO) para numeración secuencial
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  owner_uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- RLS: solo el dueño ve/actualiza su contador
CREATE POLICY "Counters: owner can select"
  ON public.invoice_counters FOR SELECT
  USING (auth.uid() = owner_uid);

CREATE POLICY "Counters: owner can update"
  ON public.invoice_counters FOR UPDATE
  USING (auth.uid() = owner_uid);

CREATE POLICY "Counters: owner can insert"
  ON public.invoice_counters FOR INSERT
  WITH CHECK (auth.uid() = owner_uid);

-- 2) Tabla de facturas
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_number INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','Cobrado')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_uid, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS: solo dueño puede ver/crear/editar/borrar sus facturas
CREATE POLICY "Invoices: owner select"
  ON public.invoices FOR SELECT
  USING (auth.uid() = owner_uid);

CREATE POLICY "Invoices: owner insert"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = owner_uid);

CREATE POLICY "Invoices: owner update"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = owner_uid);

CREATE POLICY "Invoices: owner delete"
  ON public.invoices FOR DELETE
  USING (auth.uid() = owner_uid);

CREATE INDEX IF NOT EXISTS idx_invoices_owner ON public.invoices(owner_uid);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- 3) Tabla de líneas de factura
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  daily_entry_id UUID NOT NULL REFERENCES public.daily_entries(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  entry_date DATE NOT NULL,
  task_name TEXT,
  hours NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS: visible si la invoice es del dueño
CREATE POLICY "Invoice items: owner select"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.owner_uid = auth.uid()
    )
  );

CREATE POLICY "Invoice items: owner insert"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.owner_uid = auth.uid()
    )
  );

CREATE POLICY "Invoice items: owner delete"
  ON public.invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.owner_uid = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_daily ON public.invoice_items(daily_entry_id);

-- 4) Marcar entradas como facturadas: columna invoice_id en daily_entries
ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS invoice_id UUID NULL REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_entries_invoice ON public.daily_entries(invoice_id);

-- 5) Función: next invoice number por owner, transaccional y segura
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_owner UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO public.invoice_counters(owner_uid, last_number)
  VALUES (p_owner, 1)
  ON CONFLICT (owner_uid)
  DO UPDATE SET last_number = public.invoice_counters.last_number + 1,
                updated_at = NOW()
  RETURNING last_number INTO v_next;

  RETURN v_next;
END;
$$;

-- 6) Trigger: asignar invoice_number antes del INSERT
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number <= 0 THEN
    NEW.invoice_number := public.next_invoice_number(NEW.owner_uid);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_number ON public.invoices;
CREATE TRIGGER trg_set_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_invoice_number();