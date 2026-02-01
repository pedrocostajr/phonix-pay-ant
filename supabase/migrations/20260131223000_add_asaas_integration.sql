-- Asaas accounts table
CREATE TABLE public.asaas_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  wallet_id TEXT, -- Optional, for split/subaccounts
  environment TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' or 'production'
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for Asaas accounts
ALTER TABLE public.asaas_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view Asaas accounts"
ON public.asaas_accounts FOR SELECT
TO authenticated
USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can insert Asaas accounts"
ON public.asaas_accounts FOR INSERT
TO authenticated
WITH CHECK (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can update Asaas accounts"
ON public.asaas_accounts FOR UPDATE
TO authenticated
USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can delete Asaas accounts"
ON public.asaas_accounts FOR DELETE
TO authenticated
USING (public.is_team_member(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_asaas_accounts_updated_at
  BEFORE UPDATE ON public.asaas_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Modify products table
ALTER TABLE public.products
ADD COLUMN asaas_account_id UUID REFERENCES public.asaas_accounts(id) ON DELETE SET NULL,
ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'mercadopago', -- 'mercadopago', 'asaas'
ADD COLUMN subscription_cycle TEXT; -- 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY' (NULL = One-time)

COMMENT ON COLUMN public.products.payment_provider IS 'mercadopago or asaas';
COMMENT ON COLUMN public.products.subscription_cycle IS 'Cycle for Asaas subscriptions. NULL implies one-time payment.';
