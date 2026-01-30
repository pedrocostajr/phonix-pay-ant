-- Add public_key to mercado_pago_accounts
ALTER TABLE public.mercado_pago_accounts 
ADD COLUMN public_key TEXT;

-- Update the table to make public_key required initially false to support existing records, 
-- but ideally it should be satisfied. For now, we leave it nullable or set a default if needed.
-- Since it's a new field on existing table, nullable is safest.
