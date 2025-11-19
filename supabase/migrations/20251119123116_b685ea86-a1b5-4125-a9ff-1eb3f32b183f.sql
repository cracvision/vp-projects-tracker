-- Add company and payment information fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS company_tax_id TEXT,
ADD COLUMN IF NOT EXISTS company_phone TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT,
ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- Add due_date field to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Add tax and discount fields to invoices table  
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.profiles.company_name IS 'Company or consultant name for invoices';
COMMENT ON COLUMN public.profiles.company_address IS 'Company address for invoices';
COMMENT ON COLUMN public.profiles.company_tax_id IS 'Tax ID (RFC/NIF/CIF) for invoices';
COMMENT ON COLUMN public.profiles.bank_account IS 'Bank account for payment instructions';
COMMENT ON COLUMN public.invoices.due_date IS 'Payment due date';
COMMENT ON COLUMN public.invoices.tax_rate IS 'Tax rate percentage (e.g., 16 for 16%)';
COMMENT ON COLUMN public.invoices.tax_amount IS 'Calculated tax amount';