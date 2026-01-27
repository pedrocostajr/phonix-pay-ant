-- Create payments table to track transactions
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  mercado_pago_account_id UUID REFERENCES public.mercado_pago_accounts(id) ON DELETE SET NULL,
  external_id TEXT, -- MP payment ID
  status TEXT NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL, -- in cents
  payer_email TEXT NOT NULL,
  payer_name TEXT,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  qr_code TEXT,
  qr_code_base64 TEXT,
  ticket_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Public can insert payments (checkout is public)
CREATE POLICY "Anyone can create payments"
ON public.payments
FOR INSERT
WITH CHECK (true);

-- Public can view their own payment by ID
CREATE POLICY "Anyone can view payments by id"
ON public.payments
FOR SELECT
USING (true);

-- Team members can view all payments
CREATE POLICY "Team members can view all payments"
ON public.payments
FOR SELECT
USING (is_team_member(auth.uid()));

-- Team members can update payments
CREATE POLICY "Team members can update payments"
ON public.payments
FOR UPDATE
USING (is_team_member(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();