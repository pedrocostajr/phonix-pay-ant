-- Add success_url and success_button_text columns to products table
ALTER TABLE public.products
ADD COLUMN success_url TEXT,
ADD COLUMN success_button_text TEXT;
