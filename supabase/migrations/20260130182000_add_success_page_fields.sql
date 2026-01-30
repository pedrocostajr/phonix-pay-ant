-- Add success_message and whatsapp_number columns to products table
ALTER TABLE public.products
ADD COLUMN success_message TEXT,
ADD COLUMN whatsapp_number TEXT;
